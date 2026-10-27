import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CareerPlan, ProfileData } from './schema.js';

const { Pool } = pg;
export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined }) : null;
let sqlite: DatabaseSync | null = null;

export async function initializeDatabase() {
  if (pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS profiles (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, profile_data JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS career_plans (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE CASCADE, target_role TEXT NOT NULL, career_goal TEXT NOT NULL, timeline_months INTEGER NOT NULL, current_skills JSONB NOT NULL DEFAULT '[]', missing_information JSONB NOT NULL DEFAULT '[]', skill_gaps JSONB NOT NULL DEFAULT '[]', milestones JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS career_notes (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, related_skill TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query('ALTER TABLE career_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE');
    await pool.query('CREATE INDEX IF NOT EXISTS career_plans_user_updated_idx ON career_plans(user_id, updated_at DESC)');
    return;
  }
  const configuredPath=process.env.TALENTVERSE_SQLITE_PATH;
  if(configuredPath&&configuredPath!==':memory:')mkdirSync(join(configuredPath,'..'),{recursive:true});
  const folder = join(process.cwd(), 'data');
  sqlite = new DatabaseSync(configuredPath||join(folder, 'talentverse.sqlite'));
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, profile_data TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS career_plans (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, target_role TEXT NOT NULL, career_goal TEXT NOT NULL, timeline_months INTEGER NOT NULL, current_skills TEXT NOT NULL DEFAULT '[]', missing_information TEXT NOT NULL DEFAULT '[]', skill_gaps TEXT NOT NULL DEFAULT '[]', milestones TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS career_notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, related_skill TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  try { sqlite.exec('ALTER TABLE career_plans ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE'); } catch (error) { if (!(error instanceof Error && error.message.includes('duplicate column name'))) throw error; }
  sqlite.exec('CREATE INDEX IF NOT EXISTS career_plans_user_updated_idx ON career_plans(user_id, updated_at DESC)');
}

export async function checkDatabase() { if (pool) { await pool.query('SELECT 1'); return 'postgresql'; } if (sqlite) { sqlite.prepare('SELECT 1').get(); return 'sqlite'; } return 'unavailable'; }
export function closeDatabase() { sqlite?.close(); sqlite=null; }
export async function createUser(id: string, fullName: string, email: string, passwordHash: string) {
  if (pool) { const r = await pool.query('INSERT INTO users(id,full_name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,full_name,email,created_at', [id, fullName, email, passwordHash]); return r.rows[0]; }
  const r = sqlite!.prepare('INSERT INTO users(id,full_name,email,password_hash) VALUES(?,?,?,?)').run(id, fullName, email, passwordHash); void r;
  return sqlite!.prepare('SELECT id,full_name,email,created_at FROM users WHERE id=?').get(id);
}
export async function findUserByEmail(email: string) {
  if (pool) { const r = await pool.query('SELECT id,full_name,email,password_hash FROM users WHERE email=$1', [email]); return r.rows[0] ?? null; }
  return sqlite!.prepare('SELECT id,full_name,email,password_hash FROM users WHERE email=?').get(email) ?? null;
}
export async function createSession(hash: string, userId: string, expires: Date) {
  if (pool) await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [hash, userId, expires]);
  else sqlite!.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash, userId, expires.getTime());
}
export async function getSession(hash: string) {
  if (pool) { const r = await pool.query('SELECT u.id,u.full_name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()', [hash]); return r.rows[0] ?? null; }
  return sqlite!.prepare('SELECT u.id,u.full_name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash, Date.now()) ?? null;
}
export async function deleteSession(hash: string) { if (pool) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash]); else sqlite!.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash); }
export async function savePasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
  if (pool) {
    await pool.query('DELETE FROM password_resets WHERE user_id=$1 OR expires_at<=NOW()', [userId]);
    await pool.query('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [tokenHash,userId,expiresAt]);
    return;
  }
  sqlite!.prepare('DELETE FROM password_resets WHERE user_id=? OR expires_at<=?').run(userId,Date.now());
  sqlite!.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash,userId,expiresAt.getTime());
}
export async function consumePasswordReset(tokenHash: string, passwordHash: string, now = new Date()) {
  if (pool) {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const reset=await client.query('DELETE FROM password_resets WHERE token_hash=$1 AND expires_at>$2 RETURNING user_id',[tokenHash,now]);
      if(!reset.rowCount){await client.query('ROLLBACK');return false;}
      const userId=reset.rows[0].user_id;
      await client.query('UPDATE users SET password_hash=$2 WHERE id=$1',[userId,passwordHash]);
      await client.query('DELETE FROM sessions WHERE user_id=$1',[userId]);
      await client.query('COMMIT');
      return true;
    } catch(error) { await client.query('ROLLBACK');throw error; }
    finally { client.release(); }
  }
  sqlite!.exec('BEGIN IMMEDIATE');
  try {
    const reset=sqlite!.prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?').get(tokenHash,now.getTime()) as {user_id:string}|undefined;
    if(!reset){sqlite!.exec('ROLLBACK');return false;}
    sqlite!.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash,reset.user_id);
    sqlite!.prepare('DELETE FROM password_resets WHERE token_hash=?').run(tokenHash);
    sqlite!.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);
    sqlite!.exec('COMMIT');
    return true;
  } catch(error) { sqlite!.exec('ROLLBACK');throw error; }
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  if (pool) { const r = await pool.query('SELECT profile_data FROM profiles WHERE user_id=$1', [userId]); return r.rows[0]?.profile_data ?? null; }
  const r = sqlite!.prepare('SELECT profile_data FROM profiles WHERE user_id=?').get(userId) as { profile_data: string } | undefined;
  return r ? JSON.parse(r.profile_data) as ProfileData : null;
}
export async function saveProfile(userId: string, data: ProfileData) {
  if (pool) { const r = await pool.query('INSERT INTO profiles(user_id,profile_data) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET profile_data=EXCLUDED.profile_data,updated_at=NOW() RETURNING profile_data,updated_at', [userId, JSON.stringify(data)]); return r.rows[0].profile_data; }
  sqlite!.prepare('INSERT INTO profiles(user_id,profile_data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET profile_data=excluded.profile_data,updated_at=CURRENT_TIMESTAMP').run(userId, JSON.stringify(data));
  return data;
}

function fromSqlite(row: Record<string, unknown>) { return { ...row, current_skills: JSON.parse(String(row.current_skills)), missing_information: JSON.parse(String(row.missing_information)), skill_gaps: JSON.parse(String(row.skill_gaps)), milestones: JSON.parse(String(row.milestones)) }; }
export async function savePlan(id: string, userId: string, plan: CareerPlan) {
  const values = [id, userId, plan.target_role, plan.career_goal, plan.timeline_months, JSON.stringify(plan.current_skills), JSON.stringify(plan.missing_information), JSON.stringify(plan.skill_gaps), JSON.stringify(plan.milestones)];
  if (pool) { const r = await pool.query(`INSERT INTO career_plans(id,user_id,target_role,career_goal,timeline_months,current_skills,missing_information,skill_gaps,milestones) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb) RETURNING *`, values); return r.rows[0]; }
  sqlite!.prepare('INSERT INTO career_plans(id,user_id,target_role,career_goal,timeline_months,current_skills,missing_information,skill_gaps,milestones) VALUES(?,?,?,?,?,?,?,?,?)').run(...values);
  return fromSqlite(sqlite!.prepare('SELECT * FROM career_plans WHERE id=? AND user_id=?').get(id, userId) as Record<string, unknown>);
}
export async function listPlans(userId: string) {
  if (pool) { const r = await pool.query('SELECT * FROM career_plans WHERE user_id=$1 ORDER BY updated_at DESC', [userId]); return r.rows; }
  return (sqlite!.prepare('SELECT * FROM career_plans WHERE user_id=? ORDER BY updated_at DESC').all(userId) as Record<string, unknown>[]).map(fromSqlite);
}
export async function updateMilestone(id: string, userId: string, index: number, status: string) {
  let milestones: CareerPlan['milestones'];
  if (pool) { const r = await pool.query('SELECT milestones FROM career_plans WHERE id=$1 AND user_id=$2', [id, userId]); if (!r.rowCount) return null; milestones = r.rows[0].milestones; }
  else { const r = sqlite!.prepare('SELECT milestones FROM career_plans WHERE id=? AND user_id=?').get(id, userId) as { milestones: string } | undefined; if (!r) return null; milestones = JSON.parse(r.milestones); }
  if (index < 0 || index >= milestones.length) return null;
  milestones[index].status = status as CareerPlan['milestones'][number]['status'];
  if (pool) { const r = await pool.query('UPDATE career_plans SET milestones=$3::jsonb,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *', [id, userId, JSON.stringify(milestones)]); return r.rows[0]; }
  sqlite!.prepare('UPDATE career_plans SET milestones=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(JSON.stringify(milestones), id, userId);
  return fromSqlite(sqlite!.prepare('SELECT * FROM career_plans WHERE id=? AND user_id=?').get(id, userId) as Record<string, unknown>);
}

export async function listNotes(userId:string) { if(pool){const r=await pool.query('SELECT * FROM career_notes WHERE user_id=$1 ORDER BY updated_at DESC',[userId]);return r.rows;}return sqlite!.prepare('SELECT * FROM career_notes WHERE user_id=? ORDER BY updated_at DESC').all(userId); }
export async function saveNote(id:string,userId:string,note:{title:string;content:string;related_skill:string}) { if(pool){const r=await pool.query('INSERT INTO career_notes(id,user_id,title,content,related_skill) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,userId,note.title,note.content,note.related_skill]);return r.rows[0];}sqlite!.prepare('INSERT INTO career_notes(id,user_id,title,content,related_skill) VALUES(?,?,?,?,?)').run(id,userId,note.title,note.content,note.related_skill);return sqlite!.prepare('SELECT * FROM career_notes WHERE id=? AND user_id=?').get(id,userId); }
export async function editNote(id:string,userId:string,note:{title:string;content:string;related_skill:string}) { if(pool){const r=await pool.query('UPDATE career_notes SET title=$3,content=$4,related_skill=$5,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',[id,userId,note.title,note.content,note.related_skill]);return r.rows[0]||null;}const r=sqlite!.prepare('UPDATE career_notes SET title=?,content=?,related_skill=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(note.title,note.content,note.related_skill,id,userId);return r.changes?sqlite!.prepare('SELECT * FROM career_notes WHERE id=? AND user_id=?').get(id,userId):null; }
export async function removeNote(id:string,userId:string) { if(pool){const r=await pool.query('DELETE FROM career_notes WHERE id=$1 AND user_id=$2',[id,userId]);return Boolean(r.rowCount);}return sqlite!.prepare('DELETE FROM career_notes WHERE id=? AND user_id=?').run(id,userId).changes>0; }
