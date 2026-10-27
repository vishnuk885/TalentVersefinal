import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { careerPlanSchema } from './schema.js';

process.env.TALENTVERSE_SQLITE_PATH=':memory:';
const db=await import('./db.js');
after(()=>db.closeDatabase());
let workflowUserId='';

const plan={
  target_role:'Frontend Developer',
  career_goal:'Become a job-ready frontend developer with a portfolio.',
  timeline_months:6,
  current_skills:['HTML','CSS'],
  missing_information:['Weekly study time'],
  skill_gaps:[{name:'JavaScript',priority:'high' as const,reason:'Build interactive browser experiences.'}],
  milestones:[
    {title:'Learn JavaScript',description:'Practice language fundamentals with small browser exercises.',month:2,priority:'high' as const,tasks:['Build a calculator'],status:'not_started' as const},
    {title:'Publish a portfolio',description:'Create and deploy projects that demonstrate frontend skills.',month:6,priority:'medium' as const,tasks:['Ship a portfolio site'],status:'not_started' as const}
  ]
};

test('validated career plan is saved and returned from the account database',async()=>{
  await db.initializeDatabase();
  workflowUserId=randomUUID();
  await db.createUser(workflowUserId,'Workflow Test','workflow@example.invalid','test-hash');

  const parsed=careerPlanSchema.safeParse(plan);
  assert.equal(parsed.success,true);
  if(!parsed.success)return;
  await db.savePlan(randomUUID(),workflowUserId,parsed.data);

  const saved=await db.listPlans(workflowUserId);
  assert.equal(saved.length,1);
  assert.equal(saved[0].target_role,'Frontend Developer');
  assert.equal(saved[0].milestones.length,2);
});

test('invalid schema output is rejected before it can become a database record',async()=>{
  const invalid={...plan,milestones:plan.milestones.map((milestone,index)=>index===1?{...milestone,month:7}:milestone)};
  const parsed=careerPlanSchema.safeParse(invalid);
  assert.equal(parsed.success,false);
  const saved=await db.listPlans(workflowUserId);
  assert.equal(saved.length,1);
});

test('career notes are private to their owner and support update and delete',async()=>{
  const note=await db.saveNote(randomUUID(),workflowUserId,{title:'Interview prep',content:'Practice explaining project tradeoffs.',related_skill:'Communication'}) as {id:string;title:string};
  assert.equal((await db.listNotes(workflowUserId)).some(item=>item.id===note.id),true);
  assert.equal((await db.listNotes(randomUUID())).length,0);
  const updated=await db.editNote(note.id,workflowUserId,{title:'Updated prep',content:'Practice behavioral examples.',related_skill:'Interviewing'}) as {title:string};
  assert.equal(updated.title,'Updated prep');
  assert.equal(await db.removeNote(note.id,workflowUserId),true);
  assert.equal(await db.removeNote(note.id,workflowUserId),false);
});
