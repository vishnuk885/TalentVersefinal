import type { CareerPlan } from './schema.js';

export type RoadmapInput = {
  goal: string;
  targetRole?: string;
  skills?: string;
  timelineMonths: number;
};

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max: number, fallback = '') => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const items = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const priority = (value: unknown): 'high'|'medium'|'low' => value === 'high' || value === 'low' ? value : 'medium';

type RoadmapLibrary = { skills: string[]; phases: [string, string, string[]][] };
function topicsFor(role: string): RoadmapLibrary {
  const key = role.toLowerCase();
  if (/gen.?ai|ai engineer|machine learning|ml engineer|llm/.test(key)) return {
    skills: ['Python for AI', 'Machine learning fundamentals', 'Deep learning and transformers', 'LLM applications and RAG', 'AI evaluation and deployment'],
    phases: [
      ['Strengthen Python and data foundations', 'Practice Python, NumPy, pandas, statistics, and Git with short coding exercises.', ['Build a data-cleaning notebook', 'Practice Python functions and data structures', 'Track work in Git']],
      ['Learn machine learning and neural networks', 'Understand supervised learning, model evaluation, neural-network basics, and transformer concepts.', ['Train and evaluate a small scikit-learn model', 'Compare precision, recall, and F1', 'Complete a small PyTorch neural-network exercise']],
      ['Build useful LLM applications', 'Learn prompting, embeddings, retrieval-augmented generation, vector search, and responsible handling of model output.', ['Create a document question-answering prototype', 'Add source citations and input validation', 'Evaluate answers on a small test set']],
      ['Ship and present an AI project', 'Package a reliable project, document its limits, and prepare evidence for a portfolio and interviews.', ['Deploy a small API or demo', 'Write setup instructions and architecture notes', 'Prepare a project walkthrough and practice role interviews']]
    ]
  };
  if (/frontend|front-end|web developer|react/.test(key)) return {
    skills: ['JavaScript and TypeScript', 'React and accessible UI', 'API integration and testing', 'Deployment and portfolio'],
    phases: [
      ['Strengthen web foundations', 'Practice semantic HTML, responsive CSS, JavaScript, TypeScript, and Git.', ['Build a responsive multi-page interface', 'Practice TypeScript data types', 'Commit work in Git']],
      ['Build interactive applications', 'Learn component design, state, forms, routing, and accessible React patterns.', ['Build a searchable dashboard', 'Add form validation and loading states', 'Check keyboard navigation']],
      ['Connect, test, and refine', 'Work with APIs, handle errors, test key flows, and improve performance.', ['Connect an API with resilient loading and error states', 'Add tests for core interactions', 'Review responsiveness and accessibility']],
      ['Publish a portfolio project', 'Deploy a polished project and prepare a clear explanation of your design and technical choices.', ['Deploy the project and verify it on mobile', 'Write a concise README and project case study', 'Practice frontend interview questions']]
    ]
  };
  if (/data|analyst|analytics/.test(key)) return {
    skills: ['SQL and data modeling', 'Python data analysis', 'Statistics and visualization', 'Portfolio and communication'],
    phases: [
      ['Build SQL and spreadsheet fluency', 'Practice joins, aggregations, data cleaning, and clear metric definitions.', ['Analyze a public dataset with SQL', 'Document assumptions and data quality issues', 'Create a small metrics summary']],
      ['Learn Python analysis', 'Use Python tools to clean, explore, and validate datasets.', ['Build a reproducible analysis notebook', 'Check missing values and outliers', 'Write reusable data-cleaning steps']],
      ['Communicate insights visually', 'Choose clear charts, explain uncertainty, and connect findings to a business question.', ['Create a focused dashboard', 'Write three evidence-based findings', 'Ask a peer to review clarity']],
      ['Publish a portfolio case study', 'Present the problem, method, findings, and limitations as a concise project.', ['Publish a sanitized case study', 'Practice explaining one analysis end-to-end', 'Prepare role-specific interview examples']]
    ]
  };
  return {
    skills: ['Role-specific technical foundations', 'Problem solving and practical projects', 'Tools and collaboration', 'Portfolio and interview preparation'],
    phases: [
      ['Map core role requirements', 'Compare the role description with current skills and build a focused foundation.', ['Review 5 current role descriptions', 'Choose one foundational course or guide', 'Record priority skill gaps']],
      ['Practice with a small project', 'Apply foundational concepts in a scoped project with clear success criteria.', ['Define a small project brief', 'Build and document a first version', 'Ask for feedback and revise']],
      ['Develop job-ready evidence', 'Improve the project, learn relevant tools, and practice explaining decisions.', ['Add a realistic feature or case study', 'Document tools and trade-offs', 'Practice role-related interview questions']],
      ['Prepare and apply deliberately', 'Polish a portfolio, tailor application materials, and set a sustainable search routine.', ['Publish the project or portfolio', 'Tailor a resume to a specific vacancy', 'Track applications and follow-ups']]
    ]
  };
}

export function createGuidedRoadmap(input: RoadmapInput): CareerPlan {
  const target = text(input.targetRole, 100, 'Career Development') || 'Career Development';
  const timeline = Math.min(24, Math.max(1, Math.round(input.timelineMonths || 6)));
  const sourceSkills = (input.skills || '').split(/[,;\n]/).map(skill => skill.trim().slice(0, 80)).filter(Boolean);
  const currentSkills = [...new Map(sourceSkills.map(skill => [skill.toLowerCase(), skill])).values()].slice(0, 30);
  const library = topicsFor(target);
  const gaps = library.skills.filter(skill => !currentSkills.some(current => current.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(current.toLowerCase())));
  const selectedGaps = (gaps.length ? gaps : [`Advanced ${library.skills[0]}`]).slice(0, 6);
  return {
    target_role: target,
    career_goal: text(input.goal, 1000, `Prepare for a ${target} role with practical skills and portfolio evidence.`).slice(0, 1000),
    timeline_months: timeline,
    current_skills: currentSkills,
    missing_information: [],
    skill_gaps: selectedGaps.map((name, index) => ({ name, priority: index < 2 ? 'high' : 'medium', reason: `Build evidence in ${name.toLowerCase()} for ${target} opportunities.` })),
    milestones: library.phases.map(([title, description, tasks], index) => ({
      title, description, month: Math.max(1, Math.ceil(timeline * (index + 1) / library.phases.length)),
      priority: index < 2 ? 'high' as const : 'medium' as const, tasks, status: 'not_started' as const
    }))
  };
}

/** Reconcile common model output variations with the strict, user-facing plan contract. */
export function normalizeRoadmap(rawValue: unknown, input: RoadmapInput): CareerPlan {
  let raw = asObject(rawValue);
  if (raw.plan) raw = asObject(raw.plan);
  const fallback = createGuidedRoadmap(input);
  const role = text(raw.target_role ?? raw.targetRole, 100, fallback.target_role) || fallback.target_role;
  const goal = text(raw.career_goal ?? raw.careerGoal ?? raw.goal, 1000, fallback.career_goal);
  const rawSkills = items(raw.current_skills ?? raw.currentSkills);
  const currentSkills = rawSkills.map(skill => text(skill, 80)).filter(Boolean).slice(0, 30);
  const rawGaps = items(raw.skill_gaps ?? raw.skillGaps ?? raw.skills_to_learn);
  const gaps = rawGaps.map((value, index) => {
    const gap = asObject(value);
    const name = text(gap.name ?? gap.skill ?? gap.title, 80);
    return name ? { name, priority: priority(gap.priority ?? gap.importance), reason: text(gap.reason ?? gap.why, 300, `Build ${name} to support progress toward ${role}.`) } : null;
  }).filter((gap): gap is NonNullable<typeof gap> => Boolean(gap)).slice(0, 12);
  const rawMilestones = items(raw.milestones ?? raw.phases ?? raw.steps);
  const timeline = fallback.timeline_months;
  const milestones = rawMilestones.map((value, index) => {
    const milestone = asObject(value);
    const monthValue = Number(milestone.month ?? milestone.month_number ?? milestone.monthNumber ?? index + 1);
    const tasks = items(milestone.tasks ?? milestone.actions).map(task => typeof task === 'string' ? text(task, 180) : text(asObject(task).description ?? asObject(task).title, 180)).filter(Boolean).slice(0, 8);
    const title = text(milestone.title ?? milestone.name, 100, `Career development milestone ${index + 1}`);
    return {
      title: title.length >= 3 ? title : `Career development milestone ${index + 1}`,
      description: text(milestone.description ?? milestone.summary, 500, `Build and demonstrate progress on ${title} for your target role.`).padEnd(10, '.'),
      month: Math.min(timeline, Math.max(1, Number.isFinite(monthValue) ? Math.round(monthValue) : index + 1)),
      priority: priority(milestone.priority), tasks: tasks.length ? tasks : ['Study the key concepts', 'Complete a practical exercise'],
      status: milestone.status === 'completed' || milestone.status === 'in_progress' ? milestone.status : 'not_started'
    };
  }).slice(0, 12);
  const mergedGaps = gaps.length ? gaps : fallback.skill_gaps;
  const safeMilestones = milestones.length >= 2 ? milestones : fallback.milestones;
  const normalized = {
    target_role: role,
    career_goal: goal.length >= 8 ? goal : fallback.career_goal,
    timeline_months: timeline,
    current_skills: currentSkills.length ? currentSkills : fallback.current_skills,
    missing_information: items(raw.missing_information ?? raw.missingInformation).map(value => text(value, 200)).filter(Boolean).slice(0, 10),
    skill_gaps: mergedGaps,
    milestones: safeMilestones
  };
  const result = careerPlanSchemaSafeParse(normalized);
  return result ?? fallback;
}

import { careerPlanSchema } from './schema.js';
function careerPlanSchemaSafeParse(value: unknown): CareerPlan | null { const parsed = careerPlanSchema.safeParse(value); return parsed.success ? parsed.data : null; }
