# API Specification

This document describes the main APIs required for Engagement Rooms, project management, documents, invites, and user directory search.

All routes are prefixed with `/api`.

All state-changing routes require:

- An authenticated user (via existing WorkOS-based auth middleware)
- Organisation and room permission checks

---

## 1. User Directory & Current Context

### 1.1 GET /api/org/current

Returns the current organisation and user context.

Response:

```json
{
  "organization": {
    "id": "string",
    "name": "string",
    "orgType": "vendor | buyer | both",
    "productAccess": ["string"]
  },
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "licenseTier": "full | guest"
  }
}
