# Codex / AI Codegen Instructions — Agama Technologies

You are modifying an existing production-ready Node.js + Express + MongoDB application.

## Stack & Structure

- Backend lives in `./backend`
  - Entry point: `backend/index.js`
  - Models: `backend/models/*.js` (Mongoose)
  - Middleware: `backend/middleware`
  - Tests: `backend/tests`
- Frontend is static HTML/JS/CSS in `./frontend`
  - On build, files are copied into `backend/public` by `scripts/copy-frontend.js`
- Deploy target: **single Render Web Service** using `render.yaml`
- Database: MongoDB (Atlas), configured via `MONGODB_URI`
- AI: OpenAI Chat Completions API
- Auth + email + SSO: **WorkOS** (Treat WorkOS as the identity provider. Do not implement your own password reset or email sending.)

## Commands

From `./backend`:

- `npm install` — install backend deps
- `npm run build-frontend` — copy `../frontend` into `./public`
- `npm run dev` — start local dev server on `http://localhost:3000`
- `npm test` — run backend tests

All changes must keep these commands working.

## Design Sources of Truth

When adding or changing features, ALWAYS read these first:

- `docs/PLATFORM_OVERVIEW.md` — product vision, suites (Vendor/Buyer) and Engagement Rooms
- `docs/DOMAIN_MODEL.md` — entities and fields that should exist
- `docs/APIS.md` — API endpoints, inputs/outputs, auth rules
- `docs/AI_SPEC.md` — AI routes, prompts, and response shapes
- `docs/ACCEPTANCE_TESTS.md` — behaviour that must hold end-to-end

Follow those docs exactly. If something is underspecified, prefer:

- Small, composable helpers
- Existing patterns in this codebase
- NO new third-party services unless explicitly required

## Backend Rules

- Use **Express** and **Mongoose** only (no Nest, no other frameworks)
- Reuse existing patterns in `index.js`:
  - Wrap new POST/PUT bodies with existing validation middleware (e.g. zod)
  - Use the same error-handling and auth middleware
- Respect organisation & license checks:
  - Use existing helpers for loading the current user and organisation
  - Enforce `orgType` and `licenseTier` behaviour as defined in `DOMAIN_MODEL`
- When adding new models:
  - Put each in `backend/models/Name.js`
  - Use the same style as existing models
  - Export as `module.exports = mongoose.model('Name', schema);`
- When calling OpenAI:
  - Use `process.env.OPENAI_API_KEY`
  - Use `fetch` to call `https://api.openai.com/v1/chat/completions`
  - Default model: `gpt-4o-mini` unless another is specified in `docs/AI_SPEC.md`
  - Respect the expected JSON output shapes defined in `docs/AI_SPEC.md`

## Frontend Rules

- Do NOT introduce React, Vue, etc. unless explicitly asked
- Continue using:
  - HTML in `frontend/*.html`
  - Behaviour in `frontend/js/*.js`
  - Bootstrap + existing CSS
- Use `fetch` for API calls to `/api/...` and handle JSON responses
- Keep styling consistent with existing patterns

## WorkOS Integration

- All authentication and email flows are handled by **WorkOS**
  - You may rely on existing WorkOS middleware and helpers
  - Do NOT add new email-sending libraries or implement your own password reset
- For invites:
  - Create `EngagementRoomInvite` records as defined in `DOMAIN_MODEL`
  - Expose minimal endpoints to create, list, and accept invites
  - The actual login and email transport is handled by WorkOS and/or existing auth flows

## Security, Permissions & Guest Tier

- Every state-changing route MUST:
  - Verify the current user via existing auth middleware
  - Enforce organisation membership and role/permission checks
- **Guest users** (`licenseTier = 'guest'`):
  - Can only see rooms they are explicitly a member of
  - Cannot see the full organisation user directory
  - Cannot access billing, configuration, or unrelated entities
- Engagement Room access:
  - Use `EngagementRoomMembership` to decide what the user can do in a given room
  - Roles: `room_admin`, `editor`, `viewer`
  - Guests are typically `viewer` or limited `editor` as specified in `APIS`

## Engagement Rooms & Project Board

Implement Engagement Rooms as described in:

- `PLATFORM_OVERVIEW.md` (concept)
- `DOMAIN_MODEL.md` (schemas)
- `APIS.md` (routes)

Key capabilities:

- Communication feed (messages)
- Project management table (issues with status and assignees)
- Document upload, commenting, and AI validation
- Deliverable / milestone tracking
- Membership and invites (internal and guest)

## Scope

Your job is to:

1. Implement the enterprise features described in the docs
2. Keep the stack as:
   - Node.js + Express
   - MongoDB (Mongoose)
   - Static HTML/Bootstrap + vanilla JS
   - OpenAI API
   - WorkOS for auth/email

Do NOT:

- Introduce new databases, queues, or frontend frameworks
- Replace WorkOS for auth/email
- Change existing auth mechanisms without explicit instructions
