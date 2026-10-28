import 'dotenv/config';
import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
// Import the parser entry directly; pdf-parse's package index runs a demo PDF when loaded through ESM.
// @ts-expect-error pdf-parse 1.x does not publish typings for its internal parser entry.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import Groq from 'groq-sdk';
import { careerPlanSchema, forgotPasswordSchema, goalRequestSchema, loginSchema, profileSchema, registerSchema, resetPasswordSchema, resumeExtractionSchema, type ProfileData } from './schema.js';
import { checkDatabase, consumePasswordReset, createSession, createUser, deleteSession, editNote, findUserByEmail, getProfile, getSession, initializeDatabase, listNotes, listPlans, pool, removeNote, saveNote, savePasswordReset, savePlan, saveProfile, updateMilestone } from './db.js';
import { roleCatalog, suggestRoles } from './jobs.js';
import { createGuidedRoadmap, extractMentionedSkills, inferTargetRole, normalizeRoadmap } from './roadmap.js';

const app = express();
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production; SQLite is for local development only.');
if (process.env.NODE_ENV === 'production' && !process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is required in production because local Ollama is not available to the hosted service.');
const allowedOrigins = (process.env.FRONTEND_URL || 'http://127.0.0.1:5175,http://localhost:5175').split(',').map(v => v.trim());
function isAllowedOrigin(req: Request) {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || origin === `${req.protocol}://${req.get('host')}`) return true;
  if (process.env.NODE_ENV !== 'production') {
    try { const parsed = new URL(origin); return parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname); } catch { return false; }
  }
  return false;
}
app.use(cors((req, callback) => callback(null, { origin: !req.headers.origin || isAllowedOrigin(req), credentials: true })));
app.use((req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && !isAllowedOrigin(req)) return res.status(403).json({ error: 'This site is not allowed to make changes.' });
  next();
});
app.use(express.json({ limit: '30kb' }));
app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');next();});

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const ollamaUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
type User = { id:string; full_name:string; email:string };
type AuthRequest = Request & { user?: User };
const cookieName = 'talentverse_session';
const sessionDays = 7;
const hashToken = (v:string) => createHash('sha256').update(v).digest('hex');
function readCookie(header = '', name = cookieName) { const pair=header.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`)); return pair ? decodeURIComponent(pair.slice(name.length+1)) : ''; }
function setSessionCookie(res:Response, token:string) { const secure=process.env.NODE_ENV==='production'; res.setHeader('Set-Cookie',`${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${secure?'Lax':'Strict'}; Max-Age=${sessionDays*86400}${secure?'; Secure':''}`); }
function clearSessionCookie(res:Response) { const secure=process.env.NODE_ENV==='production'; res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=${secure?'Lax':'Strict'}; Max-Age=0${secure?'; Secure':''}`); }
const requireAuth:RequestHandler=(req,res,next)=>{ void (async()=>{ const token=readCookie(req.headers.cookie); if(!token){res.status(401).json({error:'Sign in to continue.'});return;} const user=await getSession(hashToken(token)) as User|null; if(!user){clearSessionCookie(res);res.status(401).json({error:'Your session expired. Sign in again.'});return;} (req as AuthRequest).user=user; next(); })().catch(next); };
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{error:'Too many sign-in attempts. Wait a few minutes and try again.'}});
const resetLimiter=rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:true,legacyHeaders:false,message:{error:'Too many reset requests. Wait a few minutes and try again.'}});
const resumeLimiter=rateLimit({windowMs:10*60*1000,limit:5,standardHeaders:true,legacyHeaders:false,message:{error:'Please wait before uploading another resume.'}});

const jsonSchema = { type:'object',properties:{target_role:{type:'string'},career_goal:{type:'string'},timeline_months:{type:'integer'},current_skills:{type:'array',items:{type:'string'}},missing_information:{type:'array',items:{type:'string'}},skill_gaps:{type:'array',items:{type:'object',properties:{name:{type:'string'},priority:{type:'string',enum:['high','medium','low']},reason:{type:'string'}},required:['name','priority','reason'],additionalProperties:false}},milestones:{type:'array',items:{type:'object',properties:{title:{type:'string'},description:{type:'string'},month:{type:'integer'},priority:{type:'string',enum:['high','medium','low']},tasks:{type:'array',items:{type:'string'}},status:{type:'string',enum:['not_started','in_progress','completed']}},required:['title','description','month','priority','tasks','status'],additionalProperties:false}}},required:['target_role','career_goal','timeline_months','current_skills','missing_information','skill_gaps','milestones'],additionalProperties:false };
async function hasLocalModel() {
  try {
    const response=await fetch(`${ollamaUrl}/api/tags`,{signal:AbortSignal.timeout(1800)});
    if(!response.ok)return false;
    const payload=await response.json() as {models?:{name?:string;model?:string}[]};
    const wanted=(process.env.OLLAMA_MODEL||'llama3:latest').toLowerCase();
    return (payload.models||[]).some(item=>(item.name||item.model||'').toLowerCase()===wanted);
  } catch { return false; }
}
async function createStructured(prompt:string, schema:Record<string,unknown>, limit=500) {
  const system=`Return concise JSON matching this schema exactly: ${JSON.stringify(schema)}. Do not invent personal facts. Use short, useful answers.`;
  if (await hasLocalModel()) {
    const response=await fetch(`${ollamaUrl}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OLLAMA_MODEL||'llama3:latest',stream:false,format:schema,options:{num_predict:limit,temperature:0.2},messages:[{role:'system',content:system},{role:'user',content:prompt}]}),signal:AbortSignal.timeout(300000)});
    if(!response.ok)throw new Error('Local AI provider unavailable');
    const result=await response.json() as {message?:{content?:string}}; if(!result.message?.content)throw new Error('AI returned empty output'); return JSON.parse(result.message.content) as unknown;
  }
  if (groq) {
    const model = process.env.AI_MODEL || 'openai/gpt-oss-20b';
    const result = await groq.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    });
    const raw = result.choices[0]?.message?.content;
    if (!raw) throw new Error('AI returned empty output');
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as unknown;
  }
  throw new Error('AI provider not configured');
}

app.get('/api/health', async (_req,res)=>{ let database='unavailable';try{database=await checkDatabase();}catch{} const local=await hasLocalModel();const ai=local?'local_model_ready':groq?'groq_configured':'not_configured';res.status(database==='unavailable'?503:200).json({status:database==='unavailable'?'degraded':'ok',database,ai}); });

app.post('/api/auth/register',loginLimiter,async(req,res)=>{
  const parsed=registerSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Check your account details.'});
  const {fullName,email,password}=parsed.data;
  try { const user=await createUser(randomUUID(),fullName,email,await bcrypt.hash(password,12)) as User; const token=randomBytes(32).toString('base64url');await createSession(hashToken(token),user.id,new Date(Date.now()+sessionDays*86400000));setSessionCookie(res,token);res.status(201).json({user}); }
  catch(error){if(error instanceof Error && /unique|duplicate/i.test(error.message))return res.status(409).json({error:'An account with this email already exists.'});console.error('Registration error:',error instanceof Error?error.message:'unknown');res.status(503).json({error:'Could not create your account. Try again.'});}
});
app.post('/api/auth/login',loginLimiter,async(req,res)=>{
  const parsed=loginSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a valid email and password.'});
  try { const found=await findUserByEmail(parsed.data.email) as ({id:string;full_name:string;email:string;password_hash:string})|null; if(!found||!(await bcrypt.compare(parsed.data.password,found.password_hash)))return res.status(401).json({error:'Email or password is incorrect.'});const token=randomBytes(32).toString('base64url');await createSession(hashToken(token),found.id,new Date(Date.now()+sessionDays*86400000));setSessionCookie(res,token);res.json({user:{id:found.id,full_name:found.full_name,email:found.email}}); }
  catch(error){console.error('Login error:',error instanceof Error?error.message:'unknown');res.status(503).json({error:'Sign in is temporarily unavailable.'});}
});
app.post('/api/auth/forgot-password',resetLimiter,async(req,res)=>{
  const parsed=forgotPasswordSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter the email address for your account.'});
  const emailConfigured=Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL);
  if(!emailConfigured&&process.env.NODE_ENV==='production')return res.status(503).json({error:'Password reset email is not configured yet. Ask the site administrator.'});
  try {
    const found=await findUserByEmail(parsed.data.email) as {id:string;email:string;full_name:string}|null;
    let developmentResetUrl:string|undefined;
    if(found){
      const token=randomBytes(32).toString('base64url');
      await savePasswordReset(found.id,hashToken(token),new Date(Date.now()+30*60*1000));
      const frontendBase=process.env.NODE_ENV==='production'?process.env.RENDER_EXTERNAL_URL:(req.headers.origin||process.env.FRONTEND_URL?.split(',')[0].trim()||'http://127.0.0.1:5175');
      const baseUrl=(process.env.APP_BASE_URL||frontendBase||`${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
      const resetUrl=new URL('/',baseUrl);resetUrl.searchParams.set('reset',token);
      const safeName=found.full_name.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
      if(emailConfigured){
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[found.email],subject:'Reset your TalentVerse password',text:`Hello ${found.full_name},\n\nUse this secure link within 30 minutes to reset your TalentVerse password:\n${resetUrl.href}\n\nIf you did not request this, ignore this email.`,html:`<p>Hello ${safeName},</p><p>Use this secure link within 30 minutes to reset your TalentVerse password.</p><p><a href="${resetUrl.href}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`})});
        if(!response.ok)throw new Error(`Email provider returned ${response.status}`);
      } else developmentResetUrl=resetUrl.href;
    }
    res.json({message:emailConfigured?'If an account uses that email, a password reset link will be sent shortly.':'If an account matches, a reset link is ready. In local development, use the link below if shown.',...(developmentResetUrl?{developmentResetUrl}:{})});
  } catch(error){console.error('Password reset request failed:',error instanceof Error?error.message:'unknown');res.status(503).json({error:'Password reset could not be sent right now. Try again later.'});}
});
app.post('/api/auth/reset-password',resetLimiter,async(req,res)=>{
  const parsed=resetPasswordSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Check the reset link and choose a valid password.'});
  try{const changed=await consumePasswordReset(hashToken(parsed.data.token),await bcrypt.hash(parsed.data.password,12));if(!changed)return res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'});res.json({ok:true,message:'Password updated. Sign in with your new password.'});}
  catch(error){console.error('Password reset failed:',error instanceof Error?error.message:'unknown');res.status(503).json({error:'Password reset is temporarily unavailable. Try again later.'});}
});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:(req as AuthRequest).user}));
app.post('/api/auth/logout',async(req,res)=>{const token=readCookie(req.headers.cookie);if(token)try{await deleteSession(hashToken(token));}catch{}clearSessionCookie(res);res.json({ok:true});});

app.get('/api/profile',requireAuth,async(req,res)=>{try{const user=(req as AuthRequest).user!;const profile=await getProfile(user.id);res.json({user,profile:profile||profileSchema.parse({})});}catch{res.status(503).json({error:'Could not load your profile.'});}});
app.put('/api/profile',requireAuth,async(req,res)=>{const parsed=profileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Check your profile fields.'});try{const profile=await saveProfile((req as AuthRequest).user!.id,parsed.data);res.json({profile});}catch{res.status(503).json({error:'Could not save your profile.'});}});

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:6*1024*1024,files:1},fileFilter:(_req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();if(['.pdf','.docx','.txt'].includes(ext))cb(null,true);else cb(new Error('Upload a PDF, DOCX, or TXT resume.'));}});
const resumeSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    target_role: { type: 'string' },
    experience_level: { type: 'string', enum: ['student', 'entry-level', 'mid-level', 'senior', 'unknown'] },
    skills: { type: 'array', items: { type: 'string' } },
    education: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'target_role', 'experience_level', 'skills', 'education'],
  additionalProperties: false
};

function normalizeResumeExtraction(raw: unknown, fullText: string) {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const cleanedText = fullText.replace(/\s+/g, ' ').trim();

  // 1. Target role
  let targetRole = typeof obj.target_role === 'string' ? obj.target_role.trim().slice(0, 100) : '';
  if (!targetRole && typeof obj.targetRole === 'string') targetRole = (obj.targetRole as string).trim().slice(0, 100);
  if (!targetRole) targetRole = inferTargetRole(cleanedText);

  // 2. Skills
  const rawSkills = Array.isArray(obj.skills) ? obj.skills : Array.isArray(obj.key_skills) ? obj.key_skills : [];
  let skills = rawSkills.map(s => (typeof s === 'string' ? s.trim().slice(0, 80) : '')).filter(Boolean);
  if (skills.length === 0) {
    skills = extractMentionedSkills(cleanedText);
  }
  skills = [...new Set(skills)].slice(0, 30);

  // 3. Experience level
  const validLevels = ['student', 'entry-level', 'mid-level', 'senior', 'unknown'] as const;
  let level = typeof obj.experience_level === 'string' ? obj.experience_level.toLowerCase().trim() : 'unknown';
  if (level.includes('student') || level.includes('graduate') || level.includes('fresher') || level.includes('intern')) level = 'student';
  else if (level.includes('entry') || level.includes('junior') || level.includes('associate')) level = 'entry-level';
  else if (level.includes('mid') || level.includes('intermediate')) level = 'mid-level';
  else if (level.includes('senior') || level.includes('lead') || level.includes('principal')) level = 'senior';
  else if (!validLevels.includes(level as any)) level = 'unknown';

  // 4. Summary (must be min 20, max 1200)
  let summary = typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 1200) : '';
  if (summary.length < 20) {
    const skillsList = skills.slice(0, 5).join(', ');
    const rolePart = targetRole ? `targeting ${targetRole} opportunities` : 'building technical expertise';
    summary = `Candidate profile with demonstrable experience in ${skillsList || 'software engineering and technology'}, actively ${rolePart}.`;
  }
  if (summary.length < 20) {
    summary = `Candidate profile with professional skills in ${targetRole || 'modern technology and engineering'}.`;
  }

  // 5. Education
  const rawEdu = Array.isArray(obj.education) ? obj.education : [];
  let education = rawEdu.map(e => (typeof e === 'string' ? e.trim().slice(0, 180) : '')).filter(Boolean);
  if (education.length === 0) {
    const eduMatch = cleanedText.match(/\b(b\.?tech|b\.?s\.?|b\.?e\.?|bachelor|master|m\.?s\.?|degree|university|institute|college)\b[^\n,.]*/i);
    education = eduMatch ? [eduMatch[0].trim().slice(0, 180)] : ['Higher Education / Coursework'];
  }
  education = education.slice(0, 8);

  return {
    summary: summary.slice(0, 1200),
    target_role: targetRole.slice(0, 100),
    experience_level: level as (typeof validLevels)[number],
    skills,
    education
  };
}

app.post('/api/profile/resume', requireAuth, resumeLimiter, upload.single('resume'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Choose a resume file to upload.' });
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf' && !file.buffer.subarray(0, 5).toString().startsWith('%PDF-')) {
    return res.status(400).json({ error: 'That file does not look like a valid PDF.' });
  }
  if (ext === '.docx' && file.buffer.subarray(0, 2).toString() !== 'PK') {
    return res.status(400).json({ error: 'That file does not look like a valid DOCX document.' });
  }

  try {
    let text = '';
    if (ext === '.pdf') text = (await pdfParse(file.buffer)).text;
    else if (ext === '.docx') text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    else text = file.buffer.toString('utf8');

    text = text.replace(/\u0000/g, ' ').trim().slice(0, 14000);
    if (text.length < 40) {
      return res.status(422).json({ error: 'We could not read enough text from this file. Try a text-based PDF or DOCX resume.' });
    }

    let rawAi: unknown = null;
    try {
      rawAi = await createStructured(
        `Extract a truthful profile from this resume into JSON matching the schema. If target role is unclear, leave it empty. Resume text:\n${text}`,
        resumeSchema,
        900
      );
    } catch (aiErr) {
      console.warn('AI extraction provider unavailable; falling back to direct text extraction:', aiErr instanceof Error ? aiErr.message : aiErr);
    }

    const normalized = normalizeResumeExtraction(rawAi, text);
    const validated = resumeExtractionSchema.safeParse(normalized);
    if (!validated.success) {
      return res.status(502).json({ error: 'Could not extract valid profile fields from this resume. Try another file.' });
    }

    const user = (req as AuthRequest).user!;
    const old = (await getProfile(user.id)) || profileSchema.parse({});
    const profile = {
      ...old,
      summary: validated.data.summary,
      target_role: validated.data.target_role || old.target_role,
      experience_level: validated.data.experience_level,
      skills: validated.data.skills,
      education: validated.data.education,
      resume_summary: validated.data.summary,
      resume_filename: path.basename(file.originalname).slice(0, 180),
      resume_updated_at: new Date().toISOString()
    };

    // Database update following required workflow
    await saveProfile(user.id, profile);
    res.json({
      profile,
      notice: 'Resume successfully extracted and saved to your profile.'
    });
  } catch (error) {
    if (error instanceof multer.MulterError) return res.status(413).json({ error: 'Resume exceeds the 6 MB upload limit.' });
    console.error('Resume processing error:', error instanceof Error ? error.message : 'unknown');
    res.status(502).json({ error: 'Could not read this resume file. Use a text-based PDF, DOCX, or TXT file and try again.' });
  }
});

app.get('/api/jobs/suggestions',requireAuth,async(req,res)=>{try{const profile=await getProfile((req as AuthRequest).user!.id);const plan=(await listPlans((req as AuthRequest).user!.id))[0];const skills=[...(profile?.skills||[]),...(plan?.current_skills||[])];const roles=suggestRoles([...new Set(skills)],profile?.target_role||plan?.target_role||'').map(role=>({...role,search_url:`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role.title)}`}));res.json({roles,source:'curated role matches',note:'These are role recommendations, not live vacancy listings.'});}catch{res.status(503).json({error:'Could not load role recommendations.'});}});
app.get('/api/skills/plan',requireAuth,async(req,res)=>{try{const user=(req as AuthRequest).user!;const profile=await getProfile(user.id);const plans=await listPlans(user.id);const currentSkills=[...(profile?.skills||[]),...(plans[0]?.current_skills||[])];const requestedTarget=typeof req.query.targetRole==='string'?req.query.targetRole:'';const target=requestedTarget||profile?.target_role||plans[0]?.target_role||'';const role=roleCatalog.find(item=>target&&item.title.toLowerCase().includes(target.toLowerCase()))||suggestRoles(currentSkills,target)[0];if(!role)return res.json({target_role:'',skills:[],message:'Add your target role or upload a resume to get a personalized skills plan.'});const savedGaps=plans[0]?.skill_gaps as {name:string;priority:string;reason:string}[]|undefined;const skills=(savedGaps?.length?savedGaps:role.skills.filter(s=>!currentSkills.some(k=>k.toLowerCase().includes(s.toLowerCase())||s.toLowerCase().includes(k.toLowerCase()))).map((name,i)=>({name,priority:i<2?'high':'medium',reason:`A useful capability for ${role.title} roles.`}))).map((gap,i)=>({...gap,resource:role.resources[i%role.resources.length]}));res.json({target_role:target||role.title,skills,current_skills:[...new Set(currentSkills)],resources:role.resources});}catch{res.status(503).json({error:'Could not build your skills plan.'});}});

app.post('/api/career-plans/generate',requireAuth,async(req,res)=>{
  const parsed=goalRequestSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Please check your input.'});
  try{
    const user=(req as AuthRequest).user!;const profile=await getProfile(user.id);const input=parsed.data;
    const stage=input.careerStage||profile?.career_stage||'student';const hours=input.hoursPerWeek||profile?.weekly_hours||5;
    const extractedSkills=extractMentionedSkills(input.goal);
    const combinedSkills=[...new Set([...(profile?.skills||[]),...(input.skills||'').split(',').map(skill=>skill.trim()).filter(Boolean),...extractedSkills])].join(', ');
    const inferredRole=input.targetRole||inferTargetRole(input.goal, combinedSkills)||profile?.target_role||'';
    const roadmapInput={goal:input.goal,targetRole:inferredRole,skills:combinedSkills,timelineMonths:input.timelineMonths};
    let plan;let generationMode:'ai_assisted'|'guided_fallback'='ai_assisted';
    try {
      const prompt=`Create a highly practical, concrete, job-ready career roadmap for "${roadmapInput.targetRole || 'Software Professional'}" as one JSON object that exactly follows the provided schema. Do not add markdown or extra fields.
Career Goal: ${input.goal}
Target Role: ${roadmapInput.targetRole || 'Career Development'}
Current Skills: ${roadmapInput.skills || 'None reported yet'}
Career Stage: ${stage}
Weekly Study Time: ${hours} hours/week
Timeline: ${input.timelineMonths} months.

Requirements:
- skill_gaps: Identify 3 to 6 real, specific, industry-standard technical and professional skills the candidate needs to learn for this role. Give a clear, practical reason for each. Do NOT use generic placeholders like "foundations".
- milestones: Exactly 4 progressive milestones spanning months 1 to ${input.timelineMonths}. Every milestone must have a clear technical title, specific description, month number, and 3-4 concrete, actionable tasks naming real tools, techniques, or deliverables (e.g. build a specific feature, write automated tests, audit accessibility, deploy to cloud).
- Do NOT provide vague theory. Provide real-world engineering and design tasks.`;
      const planRaw=await createStructured(prompt,jsonSchema,1100);
      const normalized=normalizeRoadmap(planRaw,roadmapInput);
      const validated=careerPlanSchema.safeParse(normalized);
      if(!validated.success)throw new Error(`Normalized roadmap did not pass validation: ${JSON.stringify(validated.error.issues)}`);
      plan=validated.data;
    } catch(error) {
      generationMode='guided_fallback';
      const reason=error instanceof Error?error.message:'unknown';
      console.warn('AI roadmap unavailable; creating guided plan:',reason);
      plan=createGuidedRoadmap(roadmapInput);
    }
    res.json({plan,validated:true,generation_mode:generationMode,message:generationMode==='guided_fallback'?'The AI provider could not return a usable roadmap, so a role-tailored guided plan was created instead.':'Your AI roadmap was checked and is ready to review.'});
  }
  catch(error){console.error('Career plan generation failed:',error instanceof Error?error.message:'unknown');res.status(503).json({error:'Your profile service is unavailable. Please retry in a moment.'});}
});
app.post('/api/career-plans',requireAuth,async(req,res)=>{const parsed=careerPlanSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Plan validation failed. Review required fields and milestone months.'});try{const user=(req as AuthRequest).user!;res.status(201).json({plan:await savePlan(randomUUID(),user.id,parsed.data)});}catch(error){console.error('Plan save failed:',error instanceof Error?error.message:'unknown');res.status(503).json({error:'Could not save this roadmap.'});}});
app.get('/api/career-plans',requireAuth,async(req,res)=>{try{res.json({plans:await listPlans((req as AuthRequest).user!.id)});}catch{res.status(503).json({error:'Saved plans are unavailable.'});}});
app.patch('/api/career-plans/:id/milestones/:index',requireAuth,async(req,res)=>{const index=Number(req.params.index),status=req.body?.status;if(!Number.isInteger(index)||!['not_started','in_progress','completed'].includes(status))return res.status(400).json({error:'Choose a valid milestone and status.'});try{const plan=await updateMilestone(String(req.params.id),(req as AuthRequest).user!.id,index,status);if(!plan)return res.status(404).json({error:'Roadmap or milestone not found.'});res.json({plan});}catch{res.status(503).json({error:'Could not update the milestone.'});}});

app.use('/api',(req,res)=>res.status(404).json({error:`API route not found: ${req.method} ${req.path}`}));
if (process.env.NODE_ENV === 'production') {
  const webRoot = path.resolve(process.env.WEB_DIST_DIR || 'dist');
  app.use(express.static(webRoot, { index: false }));
  app.get('*', (_req,res,next)=>res.sendFile(path.join(webRoot,'index.html'),error=>{if(error)next(error);}));
}
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(error instanceof multer.MulterError)return res.status(413).json({error:error.code==='LIMIT_FILE_SIZE'?'Resume exceeds the 6 MB upload limit.':'Upload could not be processed.'});console.error('Request error:',error instanceof Error?error.message:'unknown');res.status(400).json({error:error instanceof Error?error.message:'Request could not be processed.'});});
const port=Number(process.env.PORT||5000);
initializeDatabase().then(()=>app.listen(port,'0.0.0.0',()=>console.log(`TalentVerse API listening on 0.0.0.0:${port}`))).catch(error=>{console.error('Database initialization failed:',error instanceof Error?error.message:'unknown');process.exitCode=1;});
