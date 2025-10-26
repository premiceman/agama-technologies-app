# Contributing Guidelines

Thanks for helping improve the Agama Technologies application! To keep the codebase healthy and predictable, please follow these standards before opening a pull request.

## Tooling & quality checks

- **Node version:** 18 or newer.
- Install backend dependencies (`cd backend && npm install`).
- Run formatters and linters before committing:
  - `npm run format` – applies Prettier across JavaScript, JSON, and Markdown files.
  - `npm run lint` – executes ESLint using the shared config at the repo root.
- Ensure automated tests pass: `npm test` (runs Jest + Supertest with an in-memory MongoDB).

## Coding standards

- Use the existing stack only (Node/Express, MongoDB via Mongoose, static frontend assets).
- Keep routes backward compatible whenever possible. New API endpoints must remain authenticated and scoped to the owning project.
- Validate all POST/PUT payloads with the shared Zod middleware (`backend/middleware/validation.js`).
- Prefer small, reusable helpers rather than duplicating large route handlers.
- Never commit secrets—use `.env.example` as the canonical reference for required variables.

## Database migrations

- Place migration scripts in `backend/scripts/` and make them idempotent.
- Each migration should support a `--dry-run` mode for safe previews.
- Document new migrations in the README (see section “Data migration helper”).

Following these guidelines keeps the service secure and makes it easier for reviewers (and future contributors) to reason about changes. Thanks again for contributing!
