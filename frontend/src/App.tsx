import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, BadgeCheck, BookOpen, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleHelp, Download, Eye, EyeOff, FileText, GraduationCap, LayoutDashboard, LoaderCircle, LogIn, LogOut, Map, Plus, Printer, Search, Settings2, ShieldCheck, Sparkles, Target, Upload, UserPlus, WandSparkles, X, ExternalLink } from 'lucide-react';

type User = { id: string; full_name: string; email: string };
type Milestone = { title: string; description: string; month: number; priority: 'high' | 'medium' | 'low'; tasks: string[]; status: 'not_started' | 'in_progress' | 'completed' };
type Plan = { id?: string; target_role: string; career_goal: string; timeline_months: number; current_skills: string[]; missing_information: string[]; skill_gaps: { name: string; priority: 'high' | 'medium' | 'low'; reason: string }[]; milestones: Milestone[]; created_at?: string };
type Profile = { headline: string; target_role: string; location: string; summary: string; experience_level: string; career_stage: 'student' | 'entry-level' | 'mid-level' | 'senior' | 'career-switcher'; weekly_hours: number; skills: string[]; education: string[]; resume_summary: string; resume_filename: string; resume_updated_at: string };
type Job = { title: string; level: string; category: string; description: string; skills: string[]; matched_skills: string[]; growth_skills: string[]; match_score: number; search_url: string; resources: { label: string; url: string }[] };
type SkillPlan = { target_role: string; skills: { name: string; priority: string; reason: string; resource: { label: string; url: string } }[]; current_skills: string[]; resources: { label: string; url: string }[]; message?: string };
type Health = { database: string; ai: string };

const blankProfile: Profile = { headline: '', target_role: '', location: '', summary: '', experience_level: '', career_stage: 'student', weekly_hours: 5, skills: [], education: [], resume_summary: '', resume_filename: '', resume_updated_at: '' };
const api = import.meta.env.VITE_API_URL || '/api';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${api}${url}`, { ...init, credentials: 'include', headers });
  let data: any = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data as T;
}

function inferTimelineMonths(text: string) {
  const match = text.match(/\b(?:(?:in|within|over|for|by)\s+)?(\d{1,2})\s*(months?|mos?|years?|yrs?)\b/i);
  if (!match) return 6;
  const amount = Number(match[1]);
  const months = /^(?:y|yr)/i.test(match[2]) ? amount * 12 : amount;
  return Math.min(24, Math.max(1, months));
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'profile', label: 'Profile & resume', icon: FileText },
  { id: 'roadmap', label: 'Career roadmaps', icon: Map },
  { id: 'skills', label: 'Skills plan', icon: GraduationCap },
  { id: 'courses', label: 'Courses & classes', icon: BookOpen },
  { id: 'jobs', label: 'Job matches', icon: BriefcaseBusiness },
  { id: 'settings', label: 'Settings', icon: Settings2 }
] as const;

type Page = typeof navItems[number]['id'];

function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '');
  const [mode, setMode] = useState<AuthMode>(() => new URLSearchParams(window.location.search).has('reset') ? 'reset' : 'register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [busy, setBusy] = useState(false);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError('');
    setSuccess('');
    setResetUrl('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const result = await request<{ message: string; developmentResetUrl?: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        setSuccess(result.message);
        setResetUrl(result.developmentResetUrl || '');
        return;
      }
      if (mode === 'reset') {
        if (password !== confirmPassword) {
          setError('Those passwords do not match.');
          return;
        }
        const result = await request<{ message: string }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, password })
        });
        setSuccess(result.message);
        setPassword('');
        setConfirmPassword('');
        setResetToken('');
        window.history.replaceState({}, '', window.location.pathname);
        setMode('login');
        return;
      }
      const result = await request<{ user: User }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(mode === 'register' ? { fullName: name, email, password } : { email, password })
      });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete this request.');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'register' ? 'Create your account' : mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password';
  const description = mode === 'register' ? 'A little clarity can change your next step.' : mode === 'login' ? 'Sign in to pick up where you left off.' : mode === 'forgot' ? 'We’ll email a secure, time-limited reset link if an account matches.' : 'Your reset link expires after 30 minutes.';

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <a className="brand auth-brand" href="#"><span className="brand-icon"><img src="/talentverse-mark.svg" alt=""/></span><span>talent<span className="brand-light">verse</span></span></a>
        <div className="auth-copy">
          <span className="eyebrow"><i/> CAREER GROWTH, WITH A PLAN</span>
          <h1>Your next move<br/>starts <em>with you.</em></h1>
          <p>Build a career profile, turn your goals into a roadmap, and discover the skills and roles that fit where you want to go.</p>
          <div className="auth-points">
            <span><Check size={14}/> Private career workspace</span>
            <span><Check size={14}/> Practical, editable roadmaps</span>
            <span><Check size={14}/> Role matches based on your skills</span>
          </div>
        </div>
        <div className="auth-story-foot"><ShieldCheck size={14}/> Your profile and resume stay in your account.</div>
      </section>
      <section className="auth-side">
        <div className="auth-card">
          <div className="auth-welcome"><div className="auth-mark"><Sparkles size={19}/></div><span>YOUR CAREER WORKSPACE</span><h2>{title}</h2><p>{description}</p></div>
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-tabs" role="tablist" aria-label="Choose account action">
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>
                <span className="auth-choice-orbit"><UserPlus size={17}/></span>
                <span><strong>Create account</strong><small>Start your career workspace</small></span>
              </button>
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>
                <span className="auth-choice-orbit"><LogIn size={17}/></span>
                <span><strong>Sign in</strong><small>Continue your journey</small></span>
              </button>
            </div>
          )}
          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label>Full name<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/></label>}
            {(mode === 'register' || mode === 'login' || mode === 'forgot') && <label>Email address<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>}
            {(mode === 'register' || mode === 'login' || mode === 'reset') && (
              <label>{mode === 'reset' ? 'New password' : 'Password'}
                <span className="password-field">
                  <input autoComplete={mode === 'register' || mode === 'reset' ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/>
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
                </span>
              </label>
            )}
            {mode === 'reset' && (
              <label>Confirm new password
                <span className="password-field">
                  <input autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} required minLength={8} maxLength={128} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your new password"/>
                  <button type="button" aria-label={showConfirmPassword ? 'Hide confirmation' : 'Show confirmation'} onClick={() => setShowConfirmPassword(v => !v)}>{showConfirmPassword ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
                </span>
              </label>
            )}
            {error && <div className="error-box" role="alert">{error}</div>}
            {success && <div className="auth-success" role="status"><Check size={15}/><span>{success}</span></div>}
            {resetUrl && <a className="auth-dev-link" href={resetUrl}>Open local password reset page <ArrowRight size={13}/></a>}
            <button className="primary-btn auth-submit" disabled={busy}>
              {busy ? <><LoaderCircle size={16} className="spin"/> Please wait…</> : mode === 'register' ? <>Create my account <ArrowRight size={16}/></> : mode === 'login' ? <>Sign in <ArrowRight size={16}/></> : mode === 'forgot' ? <>Send reset link <ArrowRight size={16}/></> : <>Update password <ArrowRight size={16}/></>}
            </button>
          </form>
          {mode === 'login' && <button type="button" className="auth-link" onClick={() => changeMode('forgot')}>Forgot password?</button>}
          {(mode === 'forgot' || mode === 'reset') && <button type="button" className="auth-link" onClick={() => changeMode('login')}>Back to sign in</button>}
          <div className="auth-assurance"><ShieldCheck size={14}/> Passwords are securely hashed. Reset links expire after 30 minutes.</div>
        </div>
        <small className="auth-footer">TalentVerse · Career intelligence for your next chapter</small>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState<Page>('overview');
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [profileDraft, setProfileDraft] = useState<Profile>(blankProfile);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<Plan | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [skillPlan, setSkillPlan] = useState<SkillPlan | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  // Single input text box for roadmap builder
  const [goal, setGoal] = useState('');
  const [draft, setDraft] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pageBusy, setPageBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Resume upload in Profile
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [cloudConsentRequired, setCloudConsentRequired] = useState(false);

  const [roadmapView, setRoadmapView] = useState<'timeline' | 'list' | 'skills'>(() => {
    const saved = localStorage.getItem('talentverse_roadmap_view');
    return saved === 'list' || saved === 'skills' ? saved : 'timeline';
  });
  const [navSearch, setNavSearch] = useState('');
  const isLocalAI = health?.ai === 'local_model_ready';

  async function loadPortal(preferredPlanId?: string) {
    setPageBusy(true);
    try {
      const [p, r, j, s, h] = await Promise.all([
        request<{ profile: Profile }>('/profile'),
        request<{ plans: Plan[] }>('/career-plans'),
        request<{ roles: Job[] }>('/jobs/suggestions'),
        request<SkillPlan>('/skills/plan'),
        request<Health>('/health')
      ]);
      const clean = { ...blankProfile, ...p.profile };
      setProfile(clean);
      setProfileDraft(clean);
      setPlans(r.plans);
      setActive(current => r.plans.find(plan => plan.id === preferredPlanId) || r.plans.find(plan => plan.id === current?.id) || r.plans[0] || null);
      setJobs(j.roles);
      setSkillPlan(s);
      setHealth(h);
    } catch (err) {
      if (err instanceof Error && err.message === 'Sign in to continue.') setUser(null);
      else setError(err instanceof Error ? err.message : 'Could not load your workspace.');
    } finally {
      setPageBusy(false);
    }
  }

  useEffect(() => {
    request<{ user: User }>('/auth/me').then(data => { setUser(data.user); }).catch(() => {}).finally(() => setAuthChecked(true));
    request<Health>('/health').then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) void loadPortal();
  }, [user?.id]);

  const selected = draft || active;
  const completed = selected?.milestones.filter(m => m.status === 'completed').length || 0;
  const progress = selected?.milestones.length ? Math.round(completed / selected.milestones.length * 100) : 0;
  const filteredJobs = useMemo(() => jobs.filter(job => !navSearch || `${job.title} ${job.category} ${job.skills.join(' ')}`.toLowerCase().includes(navSearch.toLowerCase())), [jobs, navSearch]);

  function announce(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(''), 4500);
  }

  async function generate(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!goal.trim() || goal.trim().length < 12) {
      setError('Please enter at least 12 characters about your career goal, target role, or skills.');
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    setDraft(null);
    try {
      const result = await request<{ plan: Plan; generation_mode: 'ai_assisted' | 'guided_fallback'; message: string }>('/career-plans/generate', {
        method: 'POST',
        body: JSON.stringify({
          goal: goal.trim(),
          skills: profile.skills.join(', '),
          timelineMonths: inferTimelineMonths(goal),
          careerStage: profile.career_stage,
          hoursPerWeek: profile.weekly_hours
        })
      });
      setDraft(result.plan);
      setActive(null);
      announce(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate your roadmap.');
    } finally {
      setBusy(false);
    }
  }

  function setView(view: 'timeline' | 'list' | 'skills') {
    setRoadmapView(view);
    localStorage.setItem('talentverse_roadmap_view', view);
  }

  function downloadRoadmap() {
    if (!selected) return;
    const content = [
      `# ${selected.target_role} Career Roadmap`,
      '',
      `Goal: ${selected.career_goal}`,
      `Timeline: ${selected.timeline_months} months`,
      '',
      `## Current skills`,
      `- ${selected.current_skills.join('\n- ') || 'Not specified'}`,
      '',
      `## Milestones`,
      ...selected.milestones.map(m => `### Month ${m.month}: ${m.title} (${m.priority} priority)\n${m.description}\nStatus: ${m.status.replace('_', ' ')}\nTasks:\n${m.tasks.map(task => `- [ ] ${task}`).join('\n')}`),
      '',
      `## Skill gaps`,
      ...selected.skill_gaps.map(g => `- ${g.name} (${g.priority}): ${g.reason}`)
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected.target_role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-roadmap.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderMilestone(m: Milestone, index: number) {
    return (
      <article className={`milestone ${m.status === 'completed' ? 'done' : ''}`} key={`${m.month}-${m.title}-${index}`}>
        <div className="milestone-top">
          <div>
            <span className={`priority ${m.priority}`}>${m.priority} priority</span>
            <h3>{m.title}</h3>
            <small className="milestone-month-label">Month {m.month}</small>
          </div>
          {!draft && selected && selected.id ? (
            <select aria-label={`Update ${m.title} status`} value={m.status} onChange={e => updateStatus(selected, index, e.target.value as Milestone['status'])}>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          ) : (
            <span className="status-pill"><i/>{m.status.replace('_', ' ')}</span>
          )}
        </div>
        <p>{m.description}</p>
        <ul>{m.tasks.map(task => <li key={task}><Check size={13}/>{task}</li>)}</ul>
      </article>
    );
  }

  async function savePlan() {
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      const result = await request<{ plan: Plan }>('/career-plans', {
        method: 'POST',
        body: JSON.stringify(draft)
      });
      setDraft(null);
      setActive(result.plan);
      await loadPortal(result.plan.id);
      announce('Roadmap saved to your private workspace.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your roadmap.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(plan: Plan, index: number, status: Milestone['status']) {
    if (!plan.id) return;
    try {
      const result = await request<{ plan: Plan }>(`/career-plans/${plan.id}/milestones/${index}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setActive(result.plan);
      await loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update milestone.');
    }
  }

  const profileDirty = JSON.stringify(profileDraft) !== JSON.stringify(profile);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSavingProfile(true);
    try {
      const result = await request<{ profile: Profile }>('/profile', {
        method: 'PUT',
        body: JSON.stringify(profileDraft)
      });
      const clean = { ...blankProfile, ...result.profile };
      setProfile(clean);
      setProfileDraft(clean);
      await loadPortal();
      announce('Your profile changes are saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  }



  async function uploadResume(e: FormEvent) {
    e.preventDefault();
    if (!resumeFile) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.append('resume', resumeFile);
      if (cloudConsent) form.append('cloudConsent', 'true');
      const result = await request<{ profile: Profile; notice: string }>('/profile/resume', {
        method: 'POST',
        body: form
      });
      const clean = { ...blankProfile, ...result.profile };
      setProfile(clean);
      setProfileDraft(clean);
      setResumeFile(null);
      setCloudConsentRequired(false);
      setCloudConsent(false);
      await loadPortal();
      announce(result.notice);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resume upload failed.';
      if (message.toLowerCase().includes('sent to the configured')) setCloudConsentRequired(true);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function launchRoadmapFromProfile() {
    const rolePart = profile.target_role || 'Software Professional';
    const skillsPart = profile.skills.length ? profile.skills.slice(0, 6).join(', ') : 'modern development practices';
    setGoal(`I want to advance into a ${rolePart} role in 6 months. I have experience in ${skillsPart}, and I want practical milestones with hands-on projects and interview readiness.`);
    setPage('roadmap');
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setProfile(blankProfile);
      setPlans([]);
      setActive(null);
      setPage('overview');
    }
  }

  if (!authChecked) {
    return (
      <div className="boot-screen">
        <div className="boot-logo"><Sparkles size={20}/></div>
        <LoaderCircle className="spin" size={17}/> Opening your career workspace…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={u => { setError(''); setUser(u); setPage('overview'); }}/>;
  }

  const setField = (key: keyof Profile, value: string) => setProfileDraft(current => ({ ...current, [key]: value }));
  const pageTitle = navItems.find(item => item.id === page)?.label || 'Overview';

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" onClick={e => { e.preventDefault(); setPage('overview'); }}>
          <span className="brand-icon"><img src="/talentverse-mark.svg" alt=""/></span>
          <span>talent<span className="brand-light">verse</span></span>
        </a>
        <div className="workspace-label">CAREER WORKSPACE</div>
        <nav className="portal-nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'selected' : ''}`} onClick={() => { setPage(item.id); setError(''); }}>
              <item.icon size={17}/>
              {item.label}
              {item.id === 'jobs' && jobs.length > 0 && <span className="nav-count">{jobs.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-icon"><CircleHelp size={17}/></div>
            <strong>Make progress, one step at a time.</strong>
            <p>Your roadmap is a guide. Adjust it as you learn.</p>
            <button onClick={() => setPage('roadmap')}>Build a roadmap <ArrowRight size={12}/></button>
          </div>
          <button className="account-card" onClick={() => setPage('profile')}>
            <span className="avatar">{user.full_name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</span>
            <span className="account-info"><strong>{user.full_name}</strong><small>{profile.target_role || 'Career profile'}</small></span>
            <ChevronDown size={14}/>
          </button>
        </div>
      </aside>

      <main className="portal-main" id="top">
        <header className="topbar">
          <div className="crumb">Workspace <span>/</span> {pageTitle}</div>
          <div className="top-right">
            <span className={`service-dot ${health?.database === 'sqlite' || health?.database === 'postgresql' ? '' : 'offline'}`}/>
            {health?.database === 'sqlite' ? 'Private local database' : health?.database === 'postgresql' ? 'Secure database' : 'Checking services'}
            <span className="top-divider"/>
            <button className="logout-btn" onClick={logout}><LogOut size={14}/> Sign out</button>
          </div>
        </header>

        <div className="portal-content">
          {error && <div className="global-alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15}/></button></div>}
          {notice && <div className="global-success"><Check size={15}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
          {pageBusy && <div className="loading-line"><LoaderCircle size={15} className="spin"/> Loading your private workspace…</div>}

          {page === 'overview' && (
            <>
              <section className="welcome portal-welcome">
                <div>
                  <div className="eyebrow"><span/> YOUR CAREER, IN ONE PLACE</div>
                  <h1>Good to see you, <span>{user.full_name.split(' ')[0]}.</span></h1>
                  <p>Build momentum toward <b>{profile.target_role || 'your next career goal'}</b> with a plan that’s yours to shape.</p>
                </div>
                <div className="welcome-mark"><img src="/career-orbit.svg" alt="Abstract career pathway illustration"/></div>
              </section>
              <div className="stats-row">
                <article className="stat-card">
                  <div className="stat-icon violet"><Map size={18}/></div>
                  <div><span>SAVED ROADMAPS</span><strong>{plans.length.toString().padStart(2, '0')}</strong><small>{plans.length === 1 ? 'plan in your workspace' : 'career plans created'}</small></div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon blue"><BadgeCheck size={18}/></div>
                  <div><span>COMPLETED MILESTONES</span><strong>{selected ? `${completed}/${selected.milestones.length}` : '—'}</strong><small>{selected ? `${progress}% of your current plan` : 'Create a roadmap to begin'}</small></div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon amber"><BriefcaseBusiness size={18}/></div>
                  <div><span>ROLE MATCHES</span><strong>{jobs.length ? jobs.length.toString().padStart(2, '0') : '—'}</strong><small>Based on your current profile</small></div>
                </article>
              </div>
              <div className="portal-grid">
                <section className="portal-card overview-roadmap">
                  <div className="card-head">
                    <div>
                      <div className="section-kicker">YOUR CURRENT PLAN</div>
                      <h2>{selected?.target_role || 'Make your next step concrete'}</h2>
                      <p>{selected ? `${selected.timeline_months} month roadmap · ${progress}% complete` : 'Create a roadmap from your career goal.'}</p>
                    </div>
                    {selected ? (
                      <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><span>{progress}%</span></div>
                    ) : (
                      <span className="card-head-icon"><Map size={17}/></span>
                    )}
                  </div>
                  {selected ? (
                    <>
                      <div className="overview-milestones">
                        {selected.milestones.slice(0, 3).map((m, i) => (
                          <div className="overview-step" key={m.title}>
                            <span className={`step-index ${m.status === 'completed' ? 'checked' : ''}`}>{m.status === 'completed' ? <Check size={12}/> : String(i + 1).padStart(2, '0')}</span>
                            <span><strong>{m.title}</strong><small>Month {m.month} · {m.tasks[0]}</small></span>
                            <span className={`priority ${m.priority}`}>{m.priority}</span>
                          </div>
                        ))}
                      </div>
                      <button className="text-action" onClick={() => setPage('roadmap')}>Open roadmap <ArrowRight size={14}/></button>
                    </>
                  ) : (
                    <button className="primary-btn compact-btn" onClick={() => setPage('roadmap')}><WandSparkles size={15}/> Build my first roadmap <ArrowRight size={14}/></button>
                  )}
                </section>
                <section className="portal-card profile-health">
                  <div className="section-kicker">PROFILE STRENGTH</div>
                  <h2>{profile.skills.length ? 'A strong start.' : 'Build a profile that works for you.'}</h2>
                  <p>{profile.skills.length ? 'Your reported skills help tailor role matches and learning priorities.' : 'Add skills or upload your resume to personalize career suggestions.'}</p>
                  <div className="profile-progress">
                    <span><i style={{ width: `${Math.min(100, 20 + profile.skills.length * 8 + (profile.resume_filename ? 25 : 0))}%` }}/></span>
                    <b>{Math.min(100, 20 + profile.skills.length * 8 + (profile.resume_filename ? 25 : 0))}%</b>
                  </div>
                  <div className="profile-checks">
                    <span><Check size={13}/> Account created</span>
                    <span className={profile.skills.length ? 'done' : ''}><Check size={13}/> Skills added</span>
                    <span className={profile.resume_filename ? 'done' : ''}><Check size={13}/> Resume reviewed</span>
                  </div>
                  <button className="text-action" onClick={() => setPage('profile')}>Complete my profile <ArrowRight size={14}/></button>
                </section>
                <section className="portal-card recommended-jobs">
                  <div className="card-head">
                    <div>
                      <div className="section-kicker">ROLE MATCHES</div>
                      <h2>Roles worth exploring</h2>
                    </div>
                    <button className="text-action" onClick={() => setPage('jobs')}>View all <ArrowRight size={13}/></button>
                  </div>
                  {jobs.slice(0, 3).map(job => (
                    <div className="mini-job" key={job.title}>
                      <span className="job-logo"><BriefcaseBusiness size={15}/></span>
                      <span className="mini-job-info"><strong>{job.title}</strong><small>{job.category} · {job.level}</small></span>
                      <span className="match-pill">{job.match_score}% fit</span>
                    </div>
                  ))}
                  <p className="fine-print">Role recommendations only. Vacancy links open a live job search.</p>
                </section>
                <section className="portal-card next-skill">
                  <div className="skill-card-icon"><GraduationCap size={18}/></div>
                  <div className="section-kicker">KEEP LEARNING</div>
                  <h2>{skillPlan?.skills[0]?.name || 'Your skills plan is ready to shape'}</h2>
                  <p>{skillPlan?.skills[0]?.reason || 'Choose your target role and we’ll map skills worth developing.'}</p>
                  {skillPlan?.skills[0]?.resource && (
                    <a className="text-action link-action" href={skillPlan.skills[0].resource.url} target="_blank" rel="noreferrer">Start learning <ArrowRight size={13}/></a>
                  )}
                  <button className="text-action" onClick={() => setPage('skills')}>View skills plan <ArrowRight size={13}/></button>
                </section>
              </div>
            </>
          )}

          {page === 'profile' && (
            <>
              <PageHeader kicker="YOUR CAREER PROFILE" title="A clearer picture of you." description="Keep your skills, goals, and background in one private place."/>
              <div className="profile-layout">
                <section className="portal-card profile-editor">
                  <div className="card-heading-row">
                    <div><div className="section-kicker">PROFILE DETAILS</div><p className="profile-card-caption">Your professional information and account identity.</p></div>
                    <span className="secure-chip"><ShieldCheck size={13}/> Private to your account</span>
                  </div>
                  <div className="account-details-card">
                    <span className="avatar profile-avatar">{user.full_name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</span>
                    <span className="account-details-copy"><small>ACCOUNT HOLDER</small><strong>{user.full_name}</strong><span>{user.email}</span></span>
                    <span className="account-status"><i/> Signed in</span>
                  </div>
                  <form onSubmit={saveProfile} className="profile-form">
                    <div className="form-row">
                      <label>Professional headline<input maxLength={120} value={profileDraft.headline} onChange={e => setField('headline', e.target.value)} placeholder="e.g. CS student exploring AI engineering"/></label>
                      <label>Target role<input maxLength={100} value={profileDraft.target_role} onChange={e => setField('target_role', e.target.value)} placeholder="e.g. Product Designer"/></label>
                    </div>
                    <div className="form-row">
                      <label>Location<input maxLength={100} value={profileDraft.location} onChange={e => setField('location', e.target.value)} placeholder="City or region"/></label>
                      <label>Experience level
                        <select value={profileDraft.experience_level} onChange={e => setField('experience_level', e.target.value)}>
                          <option value="">Select level</option>
                          <option value="student">Student</option>
                          <option value="entry-level">Entry-level</option>
                          <option value="mid-level">Mid-level</option>
                          <option value="senior">Senior</option>
                        </select>
                      </label>
                    </div>
                    <label>Professional summary<textarea rows={4} maxLength={1200} value={profileDraft.summary} onChange={e => setField('summary', e.target.value)} placeholder="A short introduction to your interests and experience."/></label>
                    <label>Skills <span className="field-hint">Separate skills with commas</span><input value={profileDraft.skills.join(', ')} onChange={e => setProfileDraft(p => ({ ...p, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 40) }))} placeholder="Figma, Prototyping, Accessibility, Python"/></label>
                    <label>Education <span className="field-hint">One item per line</span><textarea rows={3} value={profileDraft.education.join('\n')} onChange={e => setProfileDraft(p => ({ ...p, education: e.target.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8) }))} placeholder="B.Tech Computer Science · 2026"/></label>
                    <div className="profile-form-footer">
                      <span className={profileDirty ? 'pending' : 'saved'}><i/>{profileDirty ? 'Unsaved changes' : 'All changes saved'}</span>
                      <button className="primary-btn save-profile-btn" disabled={!profileDirty || savingProfile}>
                        {savingProfile ? <><LoaderCircle size={15} className="spin"/> Saving changes…</> : <><Check size={15}/> Save profile changes</>}
                      </button>
                    </div>
                  </form>
                </section>

                <aside className="profile-side">
                  <section className="portal-card resume-card">
                    <div className="upload-icon"><Upload size={19}/></div>
                    <div className="section-kicker">RESUME EXTRACTION & ROADMAP</div>
                    <h2>Extract profile from resume PDF</h2>
                    <p>Upload a text-based PDF, DOCX, or TXT file. TalentVerse extracts your truthful skills and target role directly into your private profile.</p>

                    <form onSubmit={uploadResume} className="resume-upload">
                      <label className="file-drop">
                        <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={e => setResumeFile(e.target.files?.[0] || null)}/>
                        <Upload size={17}/>
                        <strong>{resumeFile?.name || 'Choose a resume file'}</strong>
                        <small>PDF, DOCX or TXT · up to 6 MB</small>
                      </label>
                      {(health?.ai === 'groq_configured' || cloudConsentRequired) && !isLocalAI && (
                        <label className="consent-check">
                          <input type="checkbox" checked={cloudConsent} onChange={e => setCloudConsent(e.target.checked)}/>
                          <span>I agree to send my resume text to the configured cloud AI provider for extraction.</span>
                        </label>
                      )}
                      <button className="primary-btn resume-submit" disabled={!resumeFile || busy}>
                        {busy ? <><LoaderCircle size={15} className="spin"/> Extracting resume…</> : <><FileText size={15}/> Extract &amp; Save Profile</>}
                      </button>
                    </form>

                    {profile.resume_filename && (
                      <div className="uploaded-file" style={{ marginTop: '16px' }}>
                        <span className="file-mini"><FileText size={15}/></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{profile.resume_filename}</strong>
                          <small>{profile.resume_updated_at ? new Date(profile.resume_updated_at).toLocaleDateString() : ''} · Saved to database</small>
                        </div>
                        <BadgeCheck size={16} color="#7ce0ca"/>
                      </div>
                    )}

                    {profile.skills.length > 0 && (
                      <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
                        <div className="section-kicker">EXTRACTED SKILLS ({profile.skills.length})</div>
                        <div className="tag-row">
                          {profile.skills.slice(0, 10).map(s => <i key={s}>{s}</i>)}
                        </div>
                        <button type="button" className="secondary-btn" onClick={launchRoadmapFromProfile} style={{ marginTop: '8px' }}>
                          <WandSparkles size={14}/> Generate Career Roadmap with Profile <ArrowRight size={13}/>
                        </button>
                      </div>
                    )}

                    <div className="resume-privacy" style={{ marginTop: '14px' }}>
                      <ShieldCheck size={14}/>
                      <span>Follows verified workflow: User Input → AI Extraction → Schema Validation → DB Save → Confirmation.</span>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}

          {page === 'roadmap' && (
            <>
              <PageHeader kicker="CAREER ROADMAPS" title="Turn ambition into a career plan." description="Enter your career goal or paste your background into the single input box below. TalentVerse creates an actionable milestone roadmap."/>
              <div className="roadmap-layout">
                <section className="portal-card roadmap-form-card">
                  <div className="section-kicker">ROADMAP BUILDER</div>
                  <h2>Start with your direction</h2>
                  <p className="roadmap-prompt-intro">
                    Tell us where you want to go. Enter your target role, background, or paste your resume text directly into the box. Target role, timeline, and skill gaps are automatically analyzed.
                  </p>

                  <form onSubmit={generate} className="roadmap-form">
                    <label>Your career goal, story, or resume text
                      <textarea
                        className="roadmap-prompt"
                        required
                        minLength={12}
                        maxLength={14000}
                        value={goal}
                        onChange={e => setGoal(e.target.value)}
                        placeholder="For example: I know Figma, prototyping, and accessibility. I want to become a Product Designer in 6 months. I can study 5 hours each week and want to build a portfolio project along the way."
                      />
                    </label>
                    <div className="roadmap-prompt-meta">
                      <span>Single input box: Target role, timeline, and current skills are automatically parsed.</span>
                      <span>{goal.length.toLocaleString()} / 14,000</span>
                    </div>

                    {profile.skills.length > 0 && (
                      <div className="included-skills" style={{ marginTop: '14px' }}>
                        <span>PROFILE SKILLS INCLUDED ({profile.skills.length})</span>
                        <div className="tag-row">
                          {profile.skills.slice(0, 12).map(s => <i key={s}>{s}</i>)}
                        </div>
                      </div>
                    )}

                    <button className="primary-btn roadmap-generate" disabled={busy}>
                      {busy ? <><LoaderCircle size={16} className="spin"/> Building your roadmap…</> : <><WandSparkles size={16}/> Generate roadmap <ArrowRight size={15}/></>}
                    </button>
                    <div className="privacy-note">
                      <Sparkles size={13}/> Verified schema generation: validates role, timeline milestones, and skill gaps before saving.
                    </div>
                  </form>
                </section>

                <section className="portal-card roadmap-view">
                  <div className="card-head">
                    <div>
                      <div className="section-kicker">{draft ? 'AI PREVIEW (NOT SAVED YET)' : 'SAVED ROADMAP'}</div>
                      <h2>{selected?.target_role || 'Your roadmap will appear here'}</h2>
                      <p>{selected ? `${selected.timeline_months} month plan · ${selected.milestones.length} milestones` : 'Enter your goal above and click Generate roadmap.'}</p>
                    </div>
                    {selected && !draft && (
                      <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><span>{progress}%</span></div>
                    )}
                  </div>

                  {selected && (
                    <div className="roadmap-view-bar">
                      <div className="roadmap-view-tabs" role="tablist" aria-label="Roadmap view">
                        <button type="button" className={roadmapView === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}><CalendarDays size={14}/> Timeline</button>
                        <button type="button" className={roadmapView === 'list' ? 'active' : ''} onClick={() => setView('list')}><FileText size={14}/> Milestone list</button>
                        <button type="button" className={roadmapView === 'skills' ? 'active' : ''} onClick={() => setView('skills')}><GraduationCap size={14}/> Skill gaps</button>
                      </div>
                      <div className="roadmap-export-actions">
                        <button type="button" className="secondary-btn" onClick={downloadRoadmap}><Download size={14}/> Download</button>
                        <button type="button" className="secondary-btn" onClick={() => window.print()}><Printer size={14}/> Print / Save PDF</button>
                      </div>
                    </div>
                  )}

                  {draft && (
                    <div className="preview-banner">
                      <div>
                        <strong><Sparkles size={14}/> Review your generated plan</strong>
                        <span>Confirm this roadmap to save it to your private account database.</span>
                      </div>
                      <button type="button" onClick={savePlan} disabled={saving}>
                        {saving ? <LoaderCircle size={14} className="spin"/> : <Check size={14}/>} {saving ? 'Saving…' : 'Approve & save'}
                      </button>
                    </div>
                  )}

                  {selected ? (
                    <>
                      {roadmapView === 'timeline' && (
                        <>
                          <div className="plan-summary">
                            <span>SKILLS YOU REPORTED</span>
                            <div className="tag-row">{selected.current_skills.length ? selected.current_skills.map(s => <i key={s}>{s}</i>) : <small>No skills listed yet</small>}</div>
                          </div>
                          {selected.missing_information.length > 0 && (
                            <div className="missing-box"><strong>Worth clarifying</strong><p>{selected.missing_information.join(' · ')}</p></div>
                          )}
                          <div className="timeline">
                            {[...new Set(selected.milestones.map(m => m.month))].sort((a, b) => a - b).map(month => (
                              <div className="timeline-group" key={month}>
                                <div className="month-marker"><span>M{month}</span><i/></div>
                                <div className="milestone-list">{selected.milestones.filter(m => m.month === month).map(m => renderMilestone(m, selected.milestones.indexOf(m)))}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {roadmapView === 'list' && (
                        <div className="milestone-table">{selected.milestones.map((m, index) => renderMilestone(m, index))}</div>
                      )}
                      {roadmapView === 'skills' && (
                        <div className="gaps-section roadmap-gap-view">
                          <div className="section-kicker">SKILLS TO BUILD FOR {selected.target_role.toUpperCase()}</div>
                          <div className="gap-list">
                            {selected.skill_gaps.map(g => (
                              <div className="gap-item" key={g.name}>
                                <span className={`gap-dot ${g.priority}`}/>
                                <div><strong>{g.name}</strong><small>{g.reason}</small></div>
                                <span className={`priority ${g.priority}`}>{g.priority}</span>
                              </div>
                            ))}
                          </div>
                          {selected.missing_information.length > 0 && (
                            <div className="missing-box"><strong>Useful details to add later</strong><p>{selected.missing_information.join(' · ')}</p></div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-roadmap">
                      <div className="empty-illustration"><Target size={25}/><span><Plus size={13}/></span></div>
                      <strong>One clear input is enough to start</strong>
                      <p>Type your career goal or paste your resume text in the box to generate a structured, job-ready roadmap.</p>
                    </div>
                  )}
                </section>
              </div>

              {plans.length > 0 && (
                <section className="portal-card saved-plans">
                  <div className="card-head">
                    <div>
                      <div className="section-kicker">YOUR WORKSPACE</div>
                      <h2>Saved roadmaps</h2>
                      <p>Plans you have approved and stored in your private database.</p>
                    </div>
                    <span className="saved-count">{plans.length} {plans.length === 1 ? 'plan' : 'plans'}</span>
                  </div>
                  <div className="saved-plan-list">
                    {plans.map(plan => (
                      <button key={plan.id} className={`saved-plan-row ${active?.id === plan.id && !draft ? 'active' : ''}`} onClick={() => { setDraft(null); setActive(plan); }}>
                        <span className="saved-plan-icon"><Map size={16}/></span>
                        <span><strong>{plan.target_role}</strong><small>{plan.timeline_months} months · {plan.milestones.length} milestones</small></span>
                        <ArrowRight size={14}/>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {page === 'skills' && (
            <>
              <PageHeader kicker="PERSONALIZED LEARNING" title="Build skills with intention." description={`A focused learning plan for ${skillPlan?.target_role || profile.target_role || 'your next role'}. Recommendations adapt to your profile and saved roadmap.`}/>
              <div className="skills-intro">
                <div className="skills-intro-icon"><GraduationCap size={21}/></div>
                <div>
                  <strong>{skillPlan?.target_role || 'Set your target role'}</strong>
                  <p>{skillPlan?.current_skills?.length ? `Built around ${skillPlan.current_skills.slice(0, 5).join(', ')}.` : 'Add a target role and skills in your profile to make this plan more relevant.'}</p>
                </div>
                <button className="secondary-btn" onClick={() => setPage('profile')}><Settings2 size={14}/> Edit profile</button>
              </div>
              {skillPlan?.skills.length ? (
                <div className="skill-learning-grid">
                  {skillPlan.skills.map((item, i) => (
                    <article className="portal-card learning-card" key={item.name}>
                      <div className="learning-top">
                        <span className="learning-number">{String(i + 1).padStart(2, '0')}</span>
                        <span className={`priority ${item.priority}`}>${item.priority} focus</span>
                      </div>
                      <h2>{item.name}</h2>
                      <p>{item.reason}</p>
                      <div className="learning-resource">
                        <span className="resource-icon"><BookOpen size={15}/></span>
                        <span><small>START HERE</small><strong>{item.resource.label}</strong></span>
                      </div>
                      <a href={item.resource.url} target="_blank" rel="noreferrer" className="primary-btn learning-link">Open learning resource <ArrowDownToLine size={14}/></a>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="portal-card no-skills">
                  <GraduationCap size={23}/>
                  <strong>{skillPlan?.message || 'Add a target role to create a skill plan.'}</strong>
                  <button className="text-action" onClick={() => setPage('profile')}>Set up my profile <ArrowRight size={13}/></button>
                </div>
              )}
            </>
          )}

          {page === 'jobs' && (
            <>
              <PageHeader kicker="ROLE DISCOVERY" title="Find roles that fit your direction." description="Explore career paths that overlap with your current strengths and show which skills to grow next."/>
              <div className="job-search"><Search size={16}/><input value={navSearch} onChange={e => setNavSearch(e.target.value)} placeholder="Search role, category, or skill"/><span>{filteredJobs.length} matches</span></div>
              <div className="job-disclaimer"><CircleHelp size={14}/> These are career-role recommendations, not live vacancies. Search links open a current job board query.</div>
              <div className="job-grid">
                {filteredJobs.map(job => (
                  <article className="portal-card job-card" key={job.title}>
                    <div className="job-card-head"><span className="job-logo large"><BriefcaseBusiness size={17}/></span><span className="match-pill">{job.match_score}% match</span></div>
                    <span className="job-category">{job.category} <i/> {job.level}</span>
                    <h2>{job.title}</h2>
                    <p>{job.description}</p>
                    <div className="job-skill-label">SKILLS YOU ALREADY HAVE</div>
                    <div className="tag-row">
                      {job.matched_skills.length ? job.matched_skills.slice(0, 5).map(skill => <i key={skill}>{skill}</i>) : <small>Add profile skills for a closer match</small>}
                    </div>
                    <div className="job-skill-label grow-label">SKILLS TO BUILD</div>
                    <div className="tag-row">
                      {job.growth_skills.slice(0, 4).map(skill => <i className="growth-tag" key={skill}>{skill}</i>)}
                    </div>
                    <div className="job-card-actions">
                      <button className="secondary-btn" onClick={() => { request<SkillPlan>(`/skills/plan?targetRole=${encodeURIComponent(job.title)}`).then(setSkillPlan).then(() => setPage('skills')).catch(err => setError(err instanceof Error ? err.message : 'Could not load skills plan.')); }}>Build skills <GraduationCap size={14}/></button>
                      <a href={job.search_url} target="_blank" rel="noreferrer" className="primary-btn job-search-link">Search current openings <ArrowRight size={14}/></a>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {page === 'courses' && (
            <>
              <PageHeader kicker="SKILL-BUILDING LIBRARY" title="Learn the skills your next role needs." description={`Curated documentation, tutorials, and online classes for ${skillPlan?.target_role || profile.target_role || 'your career direction'}. Choose one resource and connect it to a roadmap milestone.`}/>
              <div className="courses-toolbar">
                <span className="course-count"><BookOpen size={15}/>{skillPlan?.resources.length || 0} curated resources</span>
                <button className="secondary-btn" onClick={() => setPage('skills')}>View skill gaps <ArrowRight size={14}/></button>
              </div>
              {skillPlan?.resources.length ? (
                <div className="course-grid">
                  {skillPlan.resources.map((resource, i) => (
                    <article className="portal-card course-card" key={resource.url}>
                      <div className="course-card-top">
                        <span className="course-icon"><GraduationCap size={17}/></span>
                        <span className="course-type">{i === 0 ? 'FOUNDATION' : 'PRACTICE RESOURCE'}</span>
                      </div>
                      <h2>{resource.label}</h2>
                      <p>Recommended for {skillPlan.target_role || profile.target_role || 'your target role'}{skillPlan.skills[i]?.name ? ` · supports ${skillPlan.skills[i].name}` : ''}.</p>
                      <a href={resource.url} target="_blank" rel="noreferrer" className="secondary-btn course-link">Open class or resource <ExternalLink size={14}/></a>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="portal-card no-skills">
                  <BookOpen size={24}/>
                  <strong>Set a target role to get relevant courses and learning links.</strong>
                  <button className="text-action" onClick={() => setPage('profile')}>Update profile <ArrowRight size={14}/></button>
                </div>
              )}
            </>
          )}

          {page === 'settings' && (
            <>
              <PageHeader kicker="WORKSPACE SETTINGS" title="Make this plan fit your life." description="Set your current career stage and realistic weekly learning time. These preferences shape new roadmap recommendations."/>
              <div className="settings-layout">
                <section className="portal-card settings-card">
                  <div className="section-kicker">CAREER PLANNING PREFERENCES</div>
                  <h2>How should TalentVerse plan with you?</h2>
                  <form onSubmit={saveProfile} className="settings-form">
                    <label>Current career stage
                      <select value={profileDraft.career_stage} onChange={e => setProfileDraft(p => ({ ...p, career_stage: e.target.value as Profile['career_stage'] }))}>
                        <option value="student">Student / new graduate</option>
                        <option value="entry-level">Early career</option>
                        <option value="mid-level">Mid career</option>
                        <option value="senior">Senior / leadership</option>
                        <option value="career-switcher">Career switcher</option>
                      </select>
                      <small>Roadmaps adapt their depth and job-search milestones to this stage.</small>
                    </label>
                    <label>Weekly learning commitment
                      <input type="number" min={1} max={60} value={profileDraft.weekly_hours} onChange={e => setProfileDraft(p => ({ ...p, weekly_hours: Number(e.target.value) }))}/>
                      <small>Choose an honest, sustainable number of hours. New plans will pace tasks around it.</small>
                    </label>
                    <label>Default roadmap view
                      <select value={roadmapView} onChange={e => setView(e.target.value as 'timeline' | 'list' | 'skills')}>
                        <option value="timeline">Timeline</option>
                        <option value="list">Milestone list</option>
                        <option value="skills">Skill gaps</option>
                      </select>
                      <small>This view is saved in this browser and opens when you return to roadmaps.</small>
                    </label>
                    <div className="profile-form-footer">
                      <span className={profileDirty ? 'pending' : 'saved'}><i/>{profileDirty ? 'Unsaved changes' : 'Preferences saved'}</span>
                      <button className="primary-btn save-profile-btn" disabled={!profileDirty || savingProfile}>
                        {savingProfile ? <><LoaderCircle size={15} className="spin"/> Saving…</> : <><Check size={15}/> Save preferences</>}
                      </button>
                    </div>
                  </form>
                </section>
                <aside className="settings-side">
                  <section className="portal-card settings-card">
                    <div className="section-kicker">ACCOUNT &amp; SECURITY</div>
                    <h2>Your account</h2>
                    <div className="settings-account">
                      <span className="avatar profile-avatar">{user.full_name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span><strong>{user.full_name}</strong><small>{user.email}</small></span>
                    </div>
                    <p>Your password is stored as a secure hash. Use <b>Forgot password?</b> on the sign-in screen to reset it. Signing out ends this browser session.</p>
                    <button type="button" className="secondary-btn" onClick={() => void logout()}><LogOut size={14}/> Sign out of this device</button>
                  </section>
                  <section className="portal-card settings-card">
                    <div className="section-kicker">YOUR DATA</div>
                    <h2>Private by account</h2>
                    <p>Your career profile and saved plans are associated with your account. Uploaded resume files are processed in memory and discarded; only fields you review and save remain in your profile.</p>
                    <button type="button" className="text-action" onClick={() => setPage('profile')}>Review profile &amp; resume <ArrowRight size={14}/></button>
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function PageHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return (
    <section className="page-heading">
      <div>
        <div className="section-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-heading-decoration"><Sparkles size={19}/></div>
    </section>
  );
}
