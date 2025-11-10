# Agama Platform — Consulting, Enterprise, Vendor (Coming Soon)

This repository contains the refactored Agama platform for consulting-led enterprise decision making. The app is built on **Node.js + Express + MongoDB** with a static client that reuses the original Agama visual language.

## Product Overview

Agama is organised around three pillars:

- **Agama Consulting** – premium discovery sessions that capture context, outcomes, risks, and artefacts to enrich customer intelligence.
- **Agama Enterprise** – the customer workspace for projects, assessments, RFX, vendor comparisons, roadmaps, and consulting artefacts.
- **Agama Vendor (Coming Soon)** – a feature-flagged placeholder for the upcoming vendor self-service portal.

### Core Concepts

- Organisations contain optional business units and projects.
- Projects are containers for assessments, RFX packages, vendor comparisons, roadmaps, consulting sessions, and supporting files.
- Schema-driven assessments, RFX sections, comparison scoring, and roadmap composition are backed by guardrailed OpenAI prompts.

## Repository Structure

```
/backend
  index.js                # Express app, session management, static file serving
  /models                 # Mongoose schemas (users, orgs, projects, assessments, etc.)
  /routes                 # Modular API endpoints for orgs, projects, RFX, AI helpers
  /services/openaiService # Deterministic prompt helpers (assessment, RFX, roadmap, etc.)
  /middleware             # Auth resolution, RBAC checks, error handler
  /utils                  # Audit logging + scoring helpers
  /scripts/seed.js        # Seeds default maturity models, demo org, project, RFX, owner user
  package.json
/client
  index.html              # Home landing page with product tiles
  projects.html           # Portfolio of projects and creation wizard
  project.html            # Project overview with navigation tabs
  assessment-new.html     # Schema-driven assessment creation flow
  rfx-new.html            # RFX creation and vendor invite experience
  comparison-new.html     # Comparison wizard for weighted scoring
  roadmap.html            # Initiative timeline view with AI copilot panel
  consulting.html         # Consulting session log and copilot suggestions
  vendor.html             # “Agama Vendor is coming soon” placeholder
  login.html / signup.html# Authentication flows reusing Agama styling
  /js                     # Lightweight client-side controllers for each page
  /css/styles.v2.css      # Unmodified design system stylesheet (kept intact)
render.yaml               # Render blueprint for single web service deployment
README.md                 # This guide
```

## Environment Variables

The server reads configuration from `.env` (create `/backend/.env` locally). Required keys:

- `MONGODB_URI` – MongoDB Atlas (or local) connection string.
- `SESSION_SECRET` – long random string for Express sessions.
- `OPENAI_API_KEY` – optional; enables live prompt execution (fallback responses are returned if unset).

## Local Development

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env   # create this file and set MONGODB_URI, SESSION_SECRET, OPENAI_API_KEY (optional)
   ```
3. **Run the development server**
   ```bash
   npm run dev            # nodemon watches backend/index.js
   ```
4. **Open the client** – visit `http://localhost:5000` (or the port reported in the terminal). Static files under `/client` are served directly by Express so no additional build step is required.

### Seed Demo Data

Populate the default maturity models, demo organisation, seed project, sample vendor profile, and initial RFX:

```bash
cd backend
npm run seed
```

Credentials created by the seed script:

- **Email**: `owner@agama.local`
- **Password**: `Password123!`

## API Surface

| Route                                              | Description                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register` / `POST /api/auth/login` | Email/password authentication with session cookies.                                                                       |
| `GET/POST/PUT/DELETE /api/orgs`                    | Organisation CRUD with audit logging; nested `/api/orgs/:id/bus` manages business units.                                  |
| `GET/POST/PUT/DELETE /api/projects`                | Project workspace management with RBAC enforcement.                                                                       |
| `GET /api/maturity-models`                         | List schema-driven assessment templates.                                                                                  |
| `POST /api/assessments`                            | Create assessments and auto-score against the active model.                                                               |
| `POST /api/rfx`                                    | Create structured RFX packages; `/invite` adds vendors.                                                                   |
| `POST /api/vendor-responses`                       | Vendor portal endpoints for drafting and submitting responses.                                                            |
| `POST /api/comparisons`                            | Aggregate vendor scores and capture comparison commentary.                                                                |
| `POST /api/roadmaps/create-from-assessments`       | Compose initiatives from assessment gaps via AI.                                                                          |
| `POST /api/consulting-sessions`                    | Log consulting sessions and transform notes into actions/risks/decisions.                                                 |
| `POST /api/ai/*`                                   | Deterministic OpenAI helpers for schema drafting, RFX generation, scoring, comparisons, roadmaps, and consulting copilot. |

All mutating operations emit `AuditEvent` records for downstream analytics and compliance.

## Deployment (Render)

The included `render.yaml` blueprint provisions a single Node web service:

- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Environment Variables**: `MONGODB_URI`, `OPENAI_API_KEY`, `SESSION_SECRET`

Static assets under `/client` are served directly by the Express app, so no extra CDN or build service is required.

## Roadmap Highlights

Near-term backlog includes:

- Schema registry UI for authoring new assessment models.
- Weighting designer presets for value vs. risk vs. fit vs. TCO comparisons.
- PDF export pipelines for assessments, comparisons, and roadmaps.
- Evidence locker with integrity hashing and provenance.

Mid-term and long-term goals cover scenario planning, compliance packs, vendor benchmarking, portfolio heatmaps, and the full Agama Vendor portal GA launch with contract intelligence and integration graph analytics.
