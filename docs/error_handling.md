# error_handling.md — Agama Technologies
Version: 1.0  
Status: Authoritative Error Handling Specification

This document defines how errors are represented, surfaced, logged, and handled across the Agama platform.

---

## 1. Error Categories

Errors are grouped into the following categories:

- `user_error` — user did something invalid but expected (for example missing field).
- `validation_error` — input did not satisfy constraints.
- `permission_denied` — user lacks required permissions.
- `not_found` — resource does not exist or not visible.
- `conflict` — operation conflicts with current state (for example version mismatch).
- `rate_limited` — too many requests.
- `integration_error` — external system failure.
- `server_error` — unexpected internal error.
- `ai_error` — AI service failure or context issue.

---

## 2. Standard Error Response Format

All API errors MUST use this envelope:

Example:

    {
      "status": "error",
      "error": {
        "code": "validation_error",
        "message": "The 'title' field is required.",
        "details": {
          "field": "title"
        }
      },
      "correlationId": "123e4567-e89b-12d3-a456-426614174000"
    }

Rules:

- `code` uses one of the categories above.
- `message` must be safe and human-readable.
- `details` is optional and must never contain secrets.
- `correlationId` is a server-generated tracing ID.

---

## 3. HTTP Status Mapping

- `user_error` or `validation_error` → 400
- `permission_denied` → 403
- `not_found` → 404
- `conflict` → 409
- `rate_limited` → 429
- `integration_error` → 502 or 503 (depending on retryability)
- `server_error` → 500
- `ai_error` → 503 (AI unavailable) or 400 (invalid request for AI)

---

## 4. Frontend Error UX

- Errors must be presented via:
  - Inline form errors (for validation).
  - Toast or banner notifications (for transient errors).
  - Full-page error state only when page cannot render at all.

Errors must:

- Use theme-consistent styling:
  - Seller theme in RevenueForge and vendor tabs.
  - Buyer theme in ProcurePath and buyer tabs.
  - Shared theme in shared panels.
- Avoid technical jargon for non-technical users.
- Provide clear calls to action where appropriate.

Examples:

- “You do not have permission to edit this RFX.”
- “The connection to your CRM has failed. Please reconnect from the Integrations page.”

---

## 5. AI Error Behaviour

When AI cannot safely answer:

- It must respond with:
  - A minimal safe message, OR
  - A clear explanation that necessary context is not available.

Examples:

- “I cannot access scoring information for this vendor in your current context.”
- “I could not generate a summary because the required data is restricted.”

AI must never:

- Hallucinate restricted information.
- Invent buyer-only or vendor-only insights.

---

## 6. Logging and Observability

Every error must be logged with:

- `correlationId`
- `userId` (if authenticated)
- `orgId` (if org-scoped)
- `endpoint` or action
- `error.code`
- Timestamp

Integration errors must additionally log:

- Integration type (CRM, Gong, Clari, ERP, etc.)
- Provider
- High-level error cause (timeout, auth failed, rate limit)

Logs must not contain PII, credentials, or sensitive payloads.

---

## 7. Retry and Backoff

Operations that may be retried:

- Integration sync jobs
- Webhook delivery
- Some AI operations

Retry strategy:

- Exponential backoff (for example 1s, 2s, 4s, 8s)
- Maximum retries: 3 by default
- Each retry logged with the same correlationId

If retries fail:

- Mark state as error in the relevant `IntegrationState` or job record.
- Notify appropriate users (as defined in `notifications.md`).

---

## 8. Graceful Degradation

If one subsystem fails (for example search, AI, real-time engine):

- The rest of the platform must remain usable.
- UI must display a non-blocking warning that certain features are degraded.
- Where possible, fall back to:
  - Polling instead of real-time.
  - Local search instead of semantic search.
  - Manual user workflows instead of AI assistance.

---

## 9. Security Considerations

- Never expose stack traces in error responses.
- Never expose unhandled exceptions.
- Use generic wording for internal failures:
  - “An unexpected error occurred. The team has been notified.”
- Detailed technical errors must only appear in logs and dashboards.

---

## 10. Summary

This document defines the standard error model for Agama.  
All new endpoints and features MUST integrate with this model, not invent their own error-handling conventions.
