import type { CareerPlan } from './schema.js';
import { roleCatalog, suggestRoles } from './jobs.js';
import { careerPlanSchema } from './schema.js';

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

export function inferTargetRole(goal: string, skills = ''): string {
  const normalized = (goal || '').toLowerCase();
  
  // Direct catalog match by role title in goal
  const catalogMatch = roleCatalog.find(role => normalized.includes(role.title.toLowerCase()))
    || (/\bgen(?:erative)?\s*ai engineer\b/i.test(goal) ? roleCatalog.find(role => role.title === 'Generative AI Engineer') : undefined)
    || (/\b(?:ui\/?ux|product design|ux design|ui design)\b/i.test(goal) ? roleCatalog.find(role => role.title === 'Product Designer') : undefined)
    || (/\b(?:qa|tester|testing|automation tester|quality assurance)\b/i.test(goal) ? { title: 'QA & Test Automation Engineer' } : undefined);
  if (catalogMatch) return catalogMatch.title;

  // Regex pattern match e.g. "become a ...", "work as a ..."
  const match = goal.match(/\b(?:become|work as|career as|target(?: role)?(?: is)?[:=]?)\s+(?:a|an|the)?\s*([a-z][a-z0-9+#./ -]{1,70}?)(?=\s+(?:and|with|by|in|using|who|that)\b|[,.!?;\n]|$)/i);
  if (match?.[1]?.trim()) return match[1].trim().replace(/\s+/g, ' ');

  // Infer from skills if present
  if (skills.trim()) {
    const skillList = skills.split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const suggested = suggestRoles(skillList);
    if (suggested.length > 0 && suggested[0].match_score >= 40) {
      return suggested[0].title;
    }
  }

  return '';
}

export function extractMentionedSkills(text: string): string[] {
  const normalized = text.toLowerCase();
  return [...new Set([...roleCatalog.flatMap(role => role.skills), 'Git', 'Testing', 'Figma', 'TypeScript', 'Docker', 'Postman', 'Playwright'])].filter(skill => normalized.includes(skill.toLowerCase()));
}

type RoadmapLibrary = { skills: string[]; phases: [string, string, string[]][] };

function topicsFor(role: string): RoadmapLibrary {
  const key = role.toLowerCase();

  // Generative AI / Machine Learning
  if (/gen.?ai|ai engineer|machine learning|ml engineer|llm/.test(key)) return {
    skills: ['Python for AI', 'Machine learning fundamentals', 'Deep learning and transformers', 'LLM applications and RAG', 'AI evaluation and deployment'],
    phases: [
      ['Strengthen Python and data foundations', 'Practice Python, NumPy, pandas, statistics, and Git with short coding exercises.', ['Build a data-cleaning notebook with Pandas and NumPy', 'Practice Python functions and data structures', 'Track work in Git with clear commit history']],
      ['Learn machine learning and neural networks', 'Understand supervised learning, model evaluation, neural-network basics, and transformer concepts.', ['Train and evaluate a scikit-learn classification model', 'Compare precision, recall, and F1 score metrics', 'Complete a PyTorch neural-network exercise']],
      ['Build useful LLM applications', 'Learn prompting, embeddings, retrieval-augmented generation, vector search, and responsible handling of model output.', ['Create a document question-answering prototype with vector search', 'Add source citations and input validation', 'Evaluate answers with automated benchmarks']],
      ['Ship and present an AI project', 'Package a reliable project, document its limits, and prepare evidence for a portfolio and interviews.', ['Deploy a FastAPI demo service to cloud hosting', 'Write setup instructions and architecture trade-offs', 'Prepare a live demo walkthrough for technical interviews']]
    ]
  };

  // Product Designer / UI/UX Designer
  if (/product design|ux|ui|designer|figma/.test(key)) return {
    skills: ['UX research and user interviews', 'Design systems and tokenization', 'Interactive prototyping and micro-interactions', 'Usability testing and accessibility (WCAG)'],
    phases: [
      ['Conduct UX research and problem definition', 'Map real user pain points, conduct stakeholder discovery, and establish information architecture.', ['Conduct 3 user interviews and synthesize insights into personas', 'Draft user journeys, site maps, and low-fidelity wireframes', 'Define measurable user success metrics and problem statements']],
      ['Master Figma design systems and auto-layout', 'Build scalable component libraries with modern Figma features and design token structures.', ['Construct an atomic design system with Figma variants and auto-layout', 'Design responsive desktop, tablet, and mobile interface views', 'Audit color contrast and typography for WCAG 2.1 AA accessibility']],
      ['Create high-fidelity interactive prototypes', 'Connect flows with micro-interactions, smart animate transitions, and realistic form behaviors.', ['Build interactive prototype with Figma Smart Animate and components', 'Test navigation and task completion with 5 real users', 'Document usability test feedback and iterate on design friction points']],
      ['Publish design case study and portfolio', 'Package the complete research-to-prototype journey with rationale and business outcomes.', ['Write a structured design case study covering problem, research, iterations, and results', 'Publish interactive prototype demo on Behance/Framer portfolio', 'Practice design whiteboarding challenges and portfolio walkthroughs']]
    ]
  };

  // Frontend Developer
  if (/frontend|front-end|web developer|react/.test(key)) return {
    skills: ['JavaScript and TypeScript fundamentals', 'React, state management, and accessible UI', 'API integration and automated testing', 'Production deployment and performance optimization'],
    phases: [
      ['Strengthen web and TypeScript foundations', 'Practice semantic HTML5, responsive CSS, modern JavaScript ES6+, and strict TypeScript.', ['Build a responsive multi-page interface with CSS Grid and Flexbox', 'Practice TypeScript interfaces, generics, and strict type safety', 'Commit modular code to GitHub with branching and PR reviews']],
      ['Build interactive React applications', 'Master component design, hooks, client state, forms, routing, and accessible UI patterns.', ['Build a searchable dynamic dashboard with React and React Router', 'Add robust form validation, error states, and keyboard navigation', 'Implement WCAG keyboard accessibility standards']],
      ['Connect APIs, test, and handle edge cases', 'Work with REST/GraphQL endpoints, handle asynchronous states, and write unit tests.', ['Connect external API with resilient loading, empty, and retry states', 'Add unit and integration tests using Vitest and React Testing Library', 'Audit and optimize Web Vitals (LCP, FID, CLS)']],
      ['Publish a production portfolio project', 'Deploy a polished full-stack application and document architectural choices for employers.', ['Deploy application to Vercel/Netlify with automated CI/CD pipeline', 'Write a concise technical README with architecture diagram', 'Practice frontend technical interview questions on DOM and React internals']]
    ]
  };

  // Backend Developer
  if (/backend|back-end|api|node|server/.test(key)) return {
    skills: ['Node.js & TypeScript service architecture', 'Relational database design & SQL optimization', 'Authentication, authorization & API security', 'Docker containerization & cloud deployment'],
    phases: [
      ['Architect robust RESTful APIs', 'Design clean endpoints, middleware pipelines, and structured input validation.', ['Build REST endpoints with Express/Fastify and Zod validation', 'Implement consistent error-handling middleware and structured logging', 'Write automated API tests with Supertest and Jest']],
      ['Master relational database modeling and SQL', 'Design normalized schemas, migrations, indexes, and transactional queries.', ['Design third-normal-form relational schema with PostgreSQL', 'Write complex joins, window functions, and transaction routines', 'Implement connection pooling and index queries for high throughput']],
      ['Implement authentication and security best practices', 'Secure services with hashed sessions, JWTs, role-based access control, and rate limiting.', ['Implement bcrypt password hashing and HttpOnly cookie sessions', 'Add rate limiting, CORS configuration, and security headers (Helmet)', 'Write automated security regression tests']],
      ['Containerize and ship backend services', 'Package services with Docker, set up CI/CD workflows, and deploy behind reverse proxies.', ['Write multi-stage Dockerfiles with minimal production images', 'Create GitHub Actions workflow for linting, testing, and Docker builds', 'Deploy service to a cloud platform with health monitoring and logging']]
    ]
  };

  // QA / Test Automation Engineer
  if (/qa|test|tester|automation|quality assurance/.test(key)) return {
    skills: ['Test strategy and exploratory testing', 'Automated E2E testing with Playwright / Cypress', 'REST API testing and Postman / Newman automation', 'CI/CD test pipeline integration and reporting'],
    phases: [
      ['Establish comprehensive test planning', 'Analyze requirements, construct test matrices, boundary value tests, and bug reporting standards.', ['Write comprehensive test plans and boundary-value test matrices for a web application', 'Execute structured exploratory testing and file bug reports with reproduction steps', 'Map test coverage against user stories and functional requirements']],
      ['Automate E2E testing with Playwright and TypeScript', 'Build reliable browser automation suites with Page Object Model architecture.', ['Set up Playwright test framework with TypeScript and Page Object Models', 'Automate core user journeys with assertion checks and screenshot captures', 'Implement parallel test execution and resilient locator strategies']],
      ['Automate REST API testing and contract checks', 'Validate HTTP status codes, JSON schema schemas, auth headers, and performance benchmarks.', ['Create automated Postman / Newman test collections with environment variables', 'Validate API response payloads against strict JSON schemas', 'Run automated load tests with k6 or Artillery and analyze latency percentiles']],
      ['Integrate tests into CI/CD pipelines and report results', 'Run automated tests on every pull request with rich test reports and artifact archives.', ['Integrate Playwright and API test runs into GitHub Actions workflows', 'Publish automated test reports and failure traces to PR summaries', 'Prepare portfolio case study showcasing automated test suite and metrics']]
    ]
  };

  // Data Analyst
  if (/data|analyst|analytics|business intelligence/.test(key)) return {
    skills: ['SQL and relational data modeling', 'Python data analysis with Pandas & NumPy', 'Interactive dashboarding & visualization (Tableau/Power BI)', 'Statistical analysis and executive communication'],
    phases: [
      ['Build SQL and relational query fluency', 'Practice complex joins, aggregations, window functions, CTEs, and data hygiene.', ['Analyze a real-world dataset using SQL CTEs and window functions', 'Document data assumptions, anomalies, and cleaning steps', 'Produce actionable summary metrics addressing a specific business question']],
      ['Perform exploratory analysis in Python', 'Clean, transform, and validate messy datasets with reproducible Python workflows.', ['Build a documented exploratory data analysis notebook in Jupyter', 'Handle missing values, detect outliers, and compute statistical correlations', 'Write modular Python data-cleaning functions']],
      ['Create interactive business dashboards', 'Design intuitive visual dashboards that communicate KPIs clearly without clutter.', ['Build an interactive dashboard in Tableau or Power BI with drill-down filters', 'Synthesize analytical findings into three evidence-backed business recommendations', 'Conduct peer review session to validate chart clarity and narrative flow']],
      ['Publish an end-to-end data case study', 'Present business context, analytical methods, findings, and limitations in a clean portfolio piece.', ['Publish a sanitized portfolio case study with reproducible code repository', 'Record a 5-minute video presentation explaining findings to stakeholders', 'Practice data analysis interview case studies and SQL challenges']]
    ]
  };

  // Cloud / DevOps Engineer
  if (/cloud|devops|infrastructure|sre|kubernetes|aws/.test(key)) return {
    skills: ['Linux administration and shell scripting', 'Docker containerization and Kubernetes orchestration', 'CI/CD pipeline automation and GitHub Actions', 'Infrastructure as Code (Terraform) and monitoring'],
    phases: [
      ['Master Linux, networking, and scripting', 'Strengthen system administration, DNS, HTTP/S protocols, and automated Bash scripts.', ['Write automated Bash scripts for log parsing and system health audits', 'Configure Linux firewall, SSH keys, systemd services, and file permissions', 'Troubleshoot network connectivity using curl, netstat, and tcpdump']],
      ['Containerize workloads with Docker and Kubernetes', 'Build optimized container images and manage pod deployments, services, and ingress.', ['Create multi-stage Dockerfiles and publish images to a container registry', 'Deploy a multi-container application to local Kubernetes (k3s/Minikube)', 'Configure ConfigMaps, Secrets, persistent volumes, and health probes']],
      ['Automate delivery pipelines and Infrastructure as Code', 'Write declarative Terraform infrastructure and automated GitHub Actions pipelines.', ['Write modular Terraform configurations to provision cloud VPC and VM instances', 'Build GitHub Actions pipeline for automated linting, security scans, and deployment', 'Implement automated rollback on failed deployment health checks']],
      ['Implement observability and site reliability practices', 'Monitor systems with Prometheus, Grafana, and structured log aggregation.', ['Configure Prometheus metrics collection and build Grafana alert dashboards', 'Implement centralized logging with Fluentd/Loki and set up error alerts', 'Prepare an infrastructure disaster recovery plan and interview case study']]
    ]
  };

  // Cybersecurity Analyst
  if (/security|cyber|soc|infosec|penetration/.test(key)) return {
    skills: ['Network security and protocol analysis', 'Vulnerability assessment and OWASP Top 10', 'SIEM monitoring and incident response', 'Security compliance and defensive hardening'],
    phases: [
      ['Master network security fundamentals', 'Analyze network traffic, packet captures, protocols, and firewall rules.', ['Analyze PCAP network captures with Wireshark to identify suspicious packets', 'Configure host-based firewall and intrusion detection rules (Snort/Suricata)', 'Document common network attacks (ARP poisoning, DNS spoofing, SYN flood)']],
      ['Perform vulnerability assessments', 'Identify application vulnerabilities, assess severity scores (CVSS), and remediate risks.', ['Conduct vulnerability scans on test environment using OpenVAS / Nmap', 'Audit web application against OWASP Top 10 vulnerabilities', 'Draft prioritized remediation report with CVSS severity rankings']],
      ['Investigate threats with SIEM and log analysis', 'Correlate authentication logs, detect anomalies, and document incident response playbooks.', ['Ingest syslog and auth logs into SIEM platform (Splunk or Elastic Security)', 'Write detection rules for brute-force attacks and privilege escalation', 'Execute tabletop incident response exercise following NIST framework']],
      ['Harden systems and document security posture', 'Apply OS hardening benchmarks (CIS), secure baseline configurations, and publish case study.', ['Apply CIS benchmarks to harden Linux and Windows test servers', 'Document security architecture review with risk matrix and mitigation strategies', 'Practice security analyst interview scenarios and incident triage walkthroughs']]
    ]
  };

  // Dynamic fallback for any other role: build concrete, technical phases directly around the role title
  return {
    skills: [
      `Core technical foundations for ${role}`,
      `Industry tools and workflow standards in ${role}`,
      `Practical project architecture and test validation`,
      `Production portfolio and technical interview readiness`
    ],
    phases: [
      [
        `Establish core technical foundations for ${role}`,
        `Master foundational syntax, design principles, and industry workflows needed for modern ${role} positions.`,
        [
          `Complete hands-on technical exercises mastering core ${role} requirements`,
          `Set up version control repository with structured documentation and branch workflows`,
          `Analyze 3 production examples and document standard architectural patterns`
        ]
      ],
      [
        `Build an applied practical project`,
        `Design and implement an end-to-end scoped project solving a realistic problem with clear success criteria.`,
        [
          `Define project specification, technical requirements, and acceptance criteria`,
          `Implement core functional features with error handling and modular structure`,
          `Review implementation against industry best practices and optimize code quality`
        ]
      ],
      [
        `Add testing, documentation, and tooling`,
        `Incorporate automated verification, performance profiling, and clean technical documentation.`,
        [
          `Write automated tests and validation suites covering critical workflows`,
          `Document design decisions, technical trade-offs, and setup instructions`,
          `Conduct peer review and resolve functional edge cases and defects`
        ]
      ],
      [
        `Ship production evidence and interview preparation`,
        `Publish a live case study, tailor targeted application materials, and practice technical interview questions.`,
        [
          `Deploy polished project with live demo URL and thorough documentation`,
          `Tailor resume and portfolio case study with quantifiable impact metrics`,
          `Practice answering in-depth technical interview questions for ${role} roles`
        ]
      ]
    ]
  };
}

export function createGuidedRoadmap(input: RoadmapInput): CareerPlan {
  const target = text(input.targetRole, 100, '') || inferTargetRole(input.goal, input.skills) || 'Software Professional';
  const timeline = Math.min(24, Math.max(1, Math.round(input.timelineMonths || 6)));
  
  const sourceSkills = (input.skills || '').split(/[,;\n]/).map(skill => skill.trim().slice(0, 80)).filter(Boolean);
  const currentSkills = [...new Map(sourceSkills.map(skill => [skill.toLowerCase(), skill])).values()].slice(0, 30);
  
  const library = topicsFor(target);
  
  // Identify actual skill gaps by comparing reported skills against library requirements
  const gaps = library.skills.filter(skill => 
    !currentSkills.some(current => current.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(current.toLowerCase()))
  );
  const selectedGaps = (gaps.length ? gaps : [`Advanced ${library.skills[0] || 'specialization'}`]).slice(0, 6);

  return {
    target_role: target,
    career_goal: text(input.goal, 1000, `Prepare for a ${target} role with practical skills and portfolio evidence.`).slice(0, 1000),
    timeline_months: timeline,
    current_skills: currentSkills,
    missing_information: currentSkills.length === 0 ? ['Specific programming languages or tools you already know'] : [],
    skill_gaps: selectedGaps.map((name, index) => ({
      name,
      priority: index < 2 ? 'high' : 'medium',
      reason: `Master ${name} to meet standard production expectations for ${target} roles.`
    })),
    milestones: library.phases.map(([title, description, tasks], index) => ({
      title,
      description,
      month: Math.max(1, Math.ceil(timeline * (index + 1) / library.phases.length)),
      priority: index < 2 ? 'high' as const : 'medium' as const,
      tasks,
      status: 'not_started' as const
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
    const title = text(milestone.title ?? milestone.name, 100, `Milestone ${index + 1}: ${role} skills`);
    return {
      title: title.length >= 3 ? title : `Milestone ${index + 1}: ${role} skills`,
      description: text(milestone.description ?? milestone.summary, 500, `Build and demonstrate progress on ${title} for your target role.`).padEnd(10, '.'),
      month: Math.min(timeline, Math.max(1, Number.isFinite(monthValue) ? Math.round(monthValue) : index + 1)),
      priority: priority(milestone.priority),
      tasks: tasks.length ? tasks : ['Study the core technical concepts', 'Build a practical implementation'],
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

function careerPlanSchemaSafeParse(value: unknown): CareerPlan | null { const parsed = careerPlanSchema.safeParse(value); return parsed.success ? parsed.data : null; }
