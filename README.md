# TalentVerse Career Portal

TalentVerse is a private career workspace for students and early-career professionals. Members can maintain a career profile, upload a resume for structured extraction, create reviewable AI roadmaps, track milestone progress, explore skill plans, and discover suggested job roles.

## Features

- Email and password registration and sign-in. Passwords are hashed; sessions use random, hashed tokens in HttpOnly, SameSite cookies with a seven-day expiry.
- Forgot-password flow uses one-time tokens that expire after 30 minutes and revokes existing sessions after a successful password change. Local development shows a reset link in the app; hosted deployments send it through Resend.
- Account-scoped profiles and roadmaps. Every profile and roadmap read/update checks the signed-in account.
- Resume parsing for PDF, DOCX, and TXT, with a 6 MB limit. The file is handled in memory, extracted to text, and discarded. Extracted fields appear in a review draft and are saved only after the member approves them.
- Resume text uses a local Ollama model when available. If only Groq is configured, the user must explicitly agree before resume text is sent to the cloud provider.
- Roadmap generation normalizes common AI response variations before validating the preview. If the configured AI service is missing or returns unusable output, a role-tailored four-stage guided roadmap is generated locally so the workflow remains available. The member must approve before the plan is saved; saved milestone status updates persist.
- Roadmaps can start from a goal or a resume draft. Career stage, timeline, existing skills, and weekly study hours guide the generated pacing. Saved plans include timeline, milestone-list, and skill-gap views, Markdown download, and print-to-PDF.
- Settings save a member's career stage and weekly study commitment to their account; the preferred roadmap view persists in the current browser.
- Personalized skill recommendations with links to learning materials.
- ATS-style resume and vacancy comparison with an evidence-based alignment estimate, matched and missing skills, and concrete editing suggestions. This is not a guarantee of an employer's screening result.
- Career notes stored per account, with create, edit, and delete actions.
- A curated courses and classes library connected to the selected role's skill resources.
- Show/hide password controls on sign-in, registration, and password reset forms.
- A custom TalentVerse SVG identity used in the app and browser tab.
- Role matching based on reported skills, with links to current job-board searches. The catalog suggests career roles; it does not claim that those role cards are live vacancies.

## Technology

React, TypeScript, Vite, Express, Zod, bcryptjs, Multer, PDF Parse, Mammoth, Ollama or Groq, SQLite for local use, and PostgreSQL for hosted use.

## Project structure

```text
frontend/
  src/                 React application and styles
  public/              TalentVerse logo and career illustration
  index.html           Vite app entry
backend/
  src/                 Express API, database, AI workflows, and tests
docs/                  Course project report
data/                  Local SQLite database (created on first run)
dist/                  Production frontend build (generated)
```

The frontend development server starts at `127.0.0.1:5175` and automatically tries the next free port if 5175 is already occupied; the backend API runs on port `5000`. `npm run dev` starts both together. Open the exact Local URL printed by Vite and stop the terminal with `Ctrl+C` when finished.

## Run locally on Windows

Requirements: Node.js 22+ and Ollama with the `llama3:latest` model, or a Groq API key.

```powershell
cd "$env:USERPROFILE\Desktop\TalentVersefinal"
npm install
npm run dev
```

Keep the terminal open and open `http://127.0.0.1:5175`. Ollama is normally available as a background service. If needed, run `ollama pull llama3:latest` once, then start the Ollama app/service. Local SQLite data is created in `data/talentverse.sqlite`.

In local development, use **Forgot password?** on the sign-in form; the response displays a one-time reset link in the app for an existing account. Hosted password-reset email requires a Resend API key and a sender address verified with Resend. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_BASE_URL` in the host environment. The app does not expose reset links in production.

Run `npm test` for schema validation checks and `npm run build` before deployment. Run one development server at a time; press Ctrl+C in its terminal before starting another copy.

## Hosted deployment

The repository includes `render.yaml` for a single-origin Render web service. Express serves both the built React site and the `/api` routes, and `/api/health` is the health check. Set `DATABASE_URL` to a PostgreSQL connection string and `GROQ_API_KEY` in the Render Blueprint's secret prompts. The production server refuses to start without these values so an online launch cannot silently fall back to temporary SQLite or run with AI disabled. The hosted AI requires Groq because the local Ollama process on your computer is not reachable by the cloud service. Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_BASE_URL` to enable hosted password-reset emails; the sender domain must be verified with Resend. Never commit `.env` or put provider/database secrets in frontend variables. When `DATABASE_URL` is not set locally, the application uses SQLite.

To publish the project:

1. Push this project to a Git provider repository you control.
2. Create a PostgreSQL project in Neon and copy its pooled/SSL connection string into Render's `DATABASE_URL` secret prompt.
3. Create a Groq API key in the provider dashboard and add it to Render as `GROQ_API_KEY`; do not paste it into source code or a public report.
4. In Render, choose **New → Blueprint**, connect your repository, review the service, and deploy. The blueprint uses the free web-service plan to avoid an automatic hosting charge.
5. After the service is live, visit `/api/health`, create a test account, generate and approve a roadmap, verify it remains after sign-out/sign-in, and record the public URL in `docs/CSB312-Project-Report.md`.

Hosting providers may sleep or impose usage limits on free tiers. Review the current plan and retention terms before publishing personal data; use a production plan and backups for a service that must remain available.

## API routes

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Database and AI provider status |
| POST | `/api/auth/register` | Public, rate limited | Create account and session |
| POST | `/api/auth/login` | Public, rate limited | Sign in |
| POST | `/api/auth/forgot-password` | Public, rate limited | Request a password-reset link |
| POST | `/api/auth/reset-password` | Public, rate limited | Consume a one-time reset token |
| GET | `/api/auth/me` | Account | Read current session |
| POST | `/api/auth/logout` | Public | End current session |
| GET / PUT | `/api/profile` | Account | Read or update career profile |
| POST | `/api/profile/resume` | Account, rate limited | Extract profile details from a resume |
| POST | `/api/ats/analyze` | Account, rate limited | Compare resume evidence with a supplied job description |
| GET / POST | `/api/notes` | Account | List or create career notes |
| PUT / DELETE | `/api/notes/:id` | Account | Edit or delete an owned career note |
| GET | `/api/jobs/suggestions` | Account | Return personalized role matches |
| GET | `/api/skills/plan` | Account | Return next-skill priorities and resources |
| POST | `/api/career-plans/generate` | Account | Generate a validated roadmap preview |
| GET / POST | `/api/career-plans` | Account | List or save approved roadmaps |
| PATCH | `/api/career-plans/:id/milestones/:index` | Account | Update an owned milestone status |

## Privacy and production notes

Resume files are not saved. Extracted profile fields remain attached to the member account only after the member reviews and saves them. ATS analysis keeps only the returned report in the current browser session and does not persist the resume or report to the database. Hosted uploads require explicit consent before resume text is sent to Groq. Password reset email delivery depends on the deployment's Resend configuration and verified sender. Before a public multi-user launch, add email verification and account deletion, operational monitoring, privacy terms, and an actual job-listings API if live vacancies are required. Role recommendations are clearly identified as recommendations, with external job-board search links.

## CSB312 report

See [`docs/CSB312-Project-Report.md`](docs/CSB312-Project-Report.md) for the report draft, architecture diagram, schema, sample output, database operations, limitations, and deployment URL placeholder. Replace the placeholder and add screenshots only after the hosted workflow is verified.
