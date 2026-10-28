import test from 'node:test';
import assert from 'node:assert/strict';
import { careerPlanSchema, forgotPasswordSchema, goalRequestSchema, profileSchema, resetPasswordSchema, resumeExtractionSchema } from './schema.js';
import { createGuidedRoadmap, extractMentionedSkills, inferTargetRole, normalizeRoadmap } from './roadmap.js';

const validPlan = {
  target_role: 'Frontend Developer',
  career_goal: 'Become a job-ready frontend developer with a portfolio.',
  timeline_months: 6,
  current_skills: ['HTML', 'CSS'],
  missing_information: ['Weekly study time'],
  skill_gaps: [{ name: 'JavaScript', priority: 'high', reason: 'Build interactive browser experiences.' }],
  milestones: [
    { title: 'Learn JavaScript', description: 'Practice language fundamentals with small browser exercises.', month: 2, priority: 'high', tasks: ['Build a calculator'], status: 'not_started' },
    { title: 'Publish a portfolio', description: 'Create and deploy projects that demonstrate frontend skills.', month: 6, priority: 'medium', tasks: ['Ship a portfolio site'], status: 'not_started' }
  ]
};

test('accepts a complete, well-formed career roadmap', () => {
  assert.equal(careerPlanSchema.safeParse(validPlan).success, true);
});

test('rejects a roadmap with a missing required skill-gap field', () => {
  const { skill_gaps: _skillGaps, ...missingField } = validPlan;
  assert.equal(careerPlanSchema.safeParse(missingField).success, false);
});

test('rejects milestones beyond the selected timeline', () => {
  const invalid = { ...validPlan, milestones: validPlan.milestones.map((milestone, index) => index ? { ...milestone, month: 7 } : milestone) };
  assert.equal(careerPlanSchema.safeParse(invalid).success, false);
});

test('rejects underspecified career goals before calling the model', () => {
  assert.equal(goalRequestSchema.safeParse({ goal: 'get a job' }).success, false);
});

test('accepts resume-length free-text input within the roadmap limit', () => {
  const resumeText = `Career history ${'experience and skills '.repeat(400)}`;
  assert.equal(resumeText.length > 3000, true);
  assert.equal(goalRequestSchema.safeParse({ goal: resumeText }).success, true);
  assert.equal(goalRequestSchema.safeParse({ goal: `${resumeText}${'x'.repeat(14000)}` }).success, false);
});

test('applies defaults to roadmap pacing and rejects invalid career stages', () => {
  const defaults=goalRequestSchema.parse({goal:'Become a frontend developer with a portfolio.'});
  assert.equal(defaults.careerStage,'student');
  assert.equal(defaults.hoursPerWeek,5);
  assert.equal(goalRequestSchema.safeParse({goal:'Become a frontend developer with a portfolio.',careerStage:'unknown'}).success,false);
});

test('profile settings enforce realistic weekly learning limits', () => {
  assert.equal(profileSchema.parse({weekly_hours:8}).weekly_hours,8);
  assert.equal(profileSchema.safeParse({weekly_hours:0}).success,false);
  assert.equal(profileSchema.safeParse({weekly_hours:61}).success,false);
});

test('rejects extracted resumes that omit a required structured field', () => {
  assert.equal(resumeExtractionSchema.safeParse({ summary: 'A capable student who has completed course and portfolio work.', target_role: '', experience_level: 'student', skills: [] }).success, false);
});

test('normalizes the email address for password reset requests', () => {
  assert.equal(forgotPasswordSchema.parse({ email: '  PERSON@Example.com ' }).email, 'person@example.com');
});

test('accepts valid reset credentials and rejects weak passwords', () => {
  const token = 'a'.repeat(43);
  assert.equal(resetPasswordSchema.safeParse({ token, password: 'strong-pass-123' }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ token, password: 'short' }).success, false);
});

test('normalizes imperfect AI roadmap fields into the strict plan contract',()=>{
  const input={goal:'Become a GenAI engineer with practical projects and an interview-ready portfolio.',targetRole:'GenAI Engineer',skills:'Python, SQL',timelineMonths:6};
  const normalized=normalizeRoadmap({targetRole:'',timeline_months:18,skillGaps:[],milestones:[{title:'Learn models',description:'Short',month:18,tasks:[]}]},input);
  assert.equal(careerPlanSchema.safeParse(normalized).success,true);
  assert.equal(normalized.target_role,'GenAI Engineer');
  assert.equal(normalized.timeline_months,6);
  assert.equal(normalized.milestones.length>=2,true);
  assert.equal(normalized.milestones.every(item=>item.month<=6),true);
  assert.equal(normalized.skill_gaps.length>0,true);
});

test('guided roadmap creates complete GenAI milestones without an AI provider',()=>{
  const plan=createGuidedRoadmap({goal:'Become a GenAI engineer and build real portfolio applications.',targetRole:'GenAI Engineer',skills:'Python, SQL',timelineMonths:6});
  assert.equal(careerPlanSchema.safeParse(plan).success,true);
  assert.equal(plan.milestones.length,4);
  assert.equal(plan.milestones.at(-1)?.month,6);
  assert.equal(plan.skill_gaps.some(gap=>/LLM|AI/i.test(gap.name)),true);
});

test('free-text career input provides useful role and skill fallbacks without an AI provider',()=>{
  assert.equal(inferTargetRole('I want to become a frontend developer and build accessible apps.'),'Frontend Developer');
  assert.equal(inferTargetRole('My goal is to become a GenAI Engineer.'),'Generative AI Engineer');
  assert.deepEqual(extractMentionedSkills('I know Python, basic machine learning, SQL, and Git.'),['Python','SQL','Machine learning','Git']);
});
