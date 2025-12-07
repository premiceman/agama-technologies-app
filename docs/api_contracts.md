# api_contracts.md — Agama Technologies
Version: 1.0  
Status: Authoritative API Specification

This document defines the API contracts used across the Agama platform.  
All backend controllers, frontend clients, and Codex-generated components MUST follow these contracts.  
If an API is not defined here, it should not be implemented without updating this file.

---

## 1. API Design Principles

1. RESTful, resource-oriented endpoints.
2. All APIs are scoped to a tenant via `orgId` and must enforce tenant isolation.
3. All requests must be authenticated and authorised.
4. Responses must follow a consistent envelope format.
5. Lists must be paginated by default.
6. Mutating operations MUST be idempotent where possible.
7. All state-changing operations must write to `AuditLog`.
8. All errors must follow the unified error structure from `error_handling.md`.

---

## 2. Authentication and Org Context

All authenticated endpoints require:

- HTTP header `Authorization: Bearer <jwt>`
- HTTP header `X-Org-Context: <orgId>` for org-scoped operations

If `X-Org-Context` is missing for an org-scoped endpoint, the server MUST:

- Return `400` with a `validation_error` code, or
- Infer org context only when unambiguous (for example, `me`-level endpoints)

Unauthenticated or invalid tokens must yield `401`.

---

## 3. Standard Response Envelope

All responses MUST use the following envelope:

### 3.1 Success Response Example

    {
      "status": "ok",
      "data": { ... },
      "pagination": {
        "limit": 20,
        "offset": 0,
        "total": 125
      },
      "correlationId": "123e4567-e89b-12d3-a456-426614174000"
    }

Notes:
- `pagination` is included only for list endpoints.
- `correlationId` is always included for tracing.

### 3.2 Error Response Example

    {
      "status": "error",
      "error": {
        "code": "validation_error",
        "message": "The 'name' field is required.",
        "details": {
          "field": "name"
        }
      },
      "correlationId": "123e4567-e89b-12d3-a456-426614174000"
    }

- `code` must be one of the error codes defined in `error_handling.md`.
- `message` must be safe and human-readable.
- `details` is optional and must never include secrets.

---

## 4. Pagination, Sorting, and Filtering

### 4.1 Pagination Request Parameters

- `limit` (integer, default 20, max 100)
- `offset` (integer, default 0)

Example URL:

    GET /api/accounts?limit=20&offset=40

### 4.2 Sorting

Optional query parameters:

- `sortBy` (field name)
- `sortDirection` (asc or desc)

### 4.3 Filtering

Filtering is entity-specific but must follow:

- Simple query parameters (for example `status=active`)
- Array filters encoded as comma-separated lists (for example `status=active,paused`)

---

## 5. Core Resource API Contracts

This section describes the core resources and key endpoints.  
Exact fields must match those defined in `domain_model.md`.

### 5.1 Users

#### GET /api/users/me

- Returns:
  - User identity
  - UserProfile
  - OrganizationMemberships
  - Preferences

#### GET /api/me/context

- Returns the authenticated user's current session context.
- Response shape (all fields required unless stated otherwise):

    {
      "status": "ok",
      "data": {
        "user": {
          "id": "user_123",
          "name": "Alex Smith",
          "email": "alex@example.com",
          "persona": "vendor"
        },
        "activeOrg": {
          "id": "org_123",
          "name": "Acme Corp",
          "seatLimits": {
            "vendorSuite": 50,
            "buyerSuite": 20,
            "bothSuites": 10
          },
          "seatUsage": {
            "vendorUsed": 34,
            "buyerUsed": 12,
            "bothUsed": 6,
            "totalUsed": 52
          },
          "contactSalesRequired": false
        },
        "orgRole": "admin",
        "suites": {
          "vendor": true,
          "buyer": false
        },
        "persona": "vendor",
        "themeHint": "vendor"
      },
      "correlationId": "123e4567-e89b-12d3-a456-426614174000"
    }

- Notes:
  - `persona` reflects the user's chosen mode and can be `vendor`, `buyer`, or `both`.
  - Seat limits are per suite and must align with billing configuration; there is no `licenseTier`, `platformAccess`, `valueAssessmentLimit`, or `sharedSuiteEnabled` field.

#### PATCH /api/users/me

- Updates:
  - Name
  - Title
  - Department
  - Avatar
  - Timezone
  - Notification preferences

Payload example:

    {
      "name": "Alex Smith",
      "title": "Sales Engineer",
      "timezone": "Europe/London",
      "notificationPreferences": {
        "inApp": true,
        "email": false
      }
    }

### 5.2 Organisations

#### GET /api/org

- Returns organisation metadata for the current `X-Org-Context`.

#### PATCH /api/org

- Org owner/admin only.
- Updates organisation settings that are not billing-related (unless billing access is granted).

#### GET /api/org/memberships

- Org owner/admin only.
- Returns list of OrganisationMemberships.

#### GET /api/org/billing

- Org owner/admin only.
- Returns current billing configuration and usage for the active org.
- Response payload (within the standard envelope):

    {
      "seatLimits": {
        "vendorSuite": 120,
        "buyerSuite": 80,
        "bothSuites": 30
      },
      "seatUsage": {
        "vendorUsed": 90,
        "buyerUsed": 65,
        "bothUsed": 18,
        "totalUsed": 173
      },
      "pricing": {
        "vendorSeatUsd": 45,
        "buyerSeatUsd": 35,
        "bothSeatUsd": 70,
        "monthlyTotalUsd": 8650
      },
      "contactSalesRequired": false
    }

#### POST /api/org/billing

- Org owner/admin only.
- Creates or replaces billing configuration when setting up seat-based licensing.
- Request body:

    {
      "seatLimits": {
        "vendorSuite": 50,
        "buyerSuite": 50,
        "bothSuites": 10
      },
      "pricing": {
        "vendorSeatUsd": 45,
        "buyerSeatUsd": 35,
        "bothSeatUsd": 70
      }
    }

- Behaviour:
  - `contactSalesRequired` becomes `true` if any seat limit (vendor, buyer, or both) exceeds 200; clients should block self-serve purchase flows when this is returned.
  - All prices are denominated in USD.

#### PATCH /api/org/billing

- Org owner/admin only.
- Partially updates seat limits or pricing.
- Request body supports updating any subset of:

    {
      "seatLimits": {
        "vendorSuite": 150,
        "buyerSuite": 150
      },
      "pricing": {
        "bothSeatUsd": 65,
        "vendorSeatUsd": 40
      }
    }

- Response mirrors `GET /api/org/billing`, recalculating `seatUsage.totalUsed` and `pricing.monthlyTotalUsd` based on the current configuration.

---

### 5.3 Invitations

#### POST /api/org/invites

- Creates an internal invite.
- Body:

    {
      "email": "user@example.com",
      "orgRole": "user",
      "vendorSuite": true,
      "buyerSuite": false,
      "superUser": {
        "vendor": false,
        "buyer": false
      }
    }

#### POST /api/rooms/{roomId}/invites/guest

- Creates a guest invite for a Room.
- Body:

    {
      "email": "external@example.com",
      "message": "Join this engagement workspace."
    }

---

### 5.4 Engagement Rooms

#### GET /api/rooms

- Returns all Rooms where the user is a `RoomParticipant`.

Supports filters:

- `status` (draft, active, closed, archived)
- `role` (vendor_user, buyer_user, guest)

#### POST /api/rooms

- Creates new Room from vendor context.
- Body:

    {
      "vendorAccountId": "acc_123",
      "buyerOrgId": "org_456",
      "roomName": "Observability Platform Evaluation"
    }

#### GET /api/rooms/{roomId}

- Returns Room metadata and summarised panels, filtered by visibility.

#### POST /api/rooms/{roomId}/messages

- Posts a message to the shared Messages panel.
- Body:

    {
      "body": "Here is the latest architecture draft.",
      "relatedEntity": {
        "type": "document",
        "id": "doc_123"
      }
    }

#### POST /api/rooms/{roomId}/tasks

- Creates a RoomTask.
- Body:

    {
      "title": "Provide security questionnaire answers",
      "description": "Complete section 3 of the RFP.",
      "visibility": "shared",
      "assigneeUserId": "user_123",
      "dueDate": "2025-01-31"
    }

#### PATCH /api/rooms/{roomId}/tasks/{taskId}

- Updates title, status, dueDate, and assignee (subject to permissions).

---

### 5.5 RevenueForge (Vendor Suite)

#### GET /api/accounts

- Returns vendor-side Accounts (AgamaAccount).
- Filters:
  - ownerUserId
  - stage
  - healthScore range

#### GET /api/accounts/{accountId}/360

- Returns:
  - Account data
  - Stakeholders
  - InteractionLog summary
  - Qualification
  - Architecture summary
  - Competitive summary
  - Linked Rooms

#### PATCH /api/accounts/{accountId}/qualification

- Updates qualification fields.

Body example:

    {
      "framework": "MEDDIC",
      "fields": [
        { "key": "economic_buyer", "value": "Yes", "confidence": 0.9 },
        { "key": "metrics", "value": "Reduction in MTTR by 35%", "confidence": 0.8 }
      ]
    }

---

### 5.6 ProcurePath (Buyer Suite)

#### GET /api/vendors

- Returns VendorRecords for buyer org.

#### POST /api/vendors

- Creates new VendorRecord.

#### GET /api/sourcing-events

- Returns SourcingEvents.

#### POST /api/sourcing-events

- Creates SourcingEvent.

---

### 5.7 RFX

#### GET /api/rfx/{rfxId}

- Returns Rfx, sections, and questions.

#### POST /api/rfx/{rfxId}/responses

- Vendor submission of responses.
- Body is an array of question responses.

Example:

    {
      "responses": [
        {
          "questionId": "q_1",
          "answerText": "We support SOC2 Type 2.",
          "attachments": ["file_abc"]
        }
      ]
    }

#### POST /api/rfx/{rfxId}/evaluations

- Buyer evaluation of vendor responses.

---

### 5.8 ValueSphere

#### GET /api/value-templates

- Returns templates filtered by:
  - scope (seller, buyer, shared)
  - orgId

#### POST /api/value-assessments

- Creates new assessment.

Body:

    {
      "templateId": "tmpl_123",
      "scope": "seller",
      "roomId": "room_456",
      "accountId": "acc_123"
    }

#### PATCH /api/value-assessments/{id}

- Updates responses or changes state (draft, shared, agreed, locked).

---

### 5.9 Search

#### GET /api/search

- Global search across entities.
- Query parameters:
  - `q` (required)
  - `scope` (optional: rooms, accounts, vendors, rfx, documents)
  - `limit`, `offset`

Results are permission-filtered.

---

## 6. Webhooks

Agama may emit outbound webhooks for key events.

Payload example:

    {
      "event": "room.created",
      "id": "evt_123",
      "orgId": "org_123",
      "actorUserId": "user_123",
      "timestamp": "2025-01-01T12:00:00Z",
      "data": {
        "roomId": "room_123",
        "vendorOrgId": "org_456",
        "buyerOrgId": "org_789",
        "status": "draft"
      }
    }

All webhook receivers must verify signatures and idempotency.

---

## 7. Rate Limiting

- Default per-user limit: 100 requests per minute.
- Burst allowance may be granted for search/real-time.
- Exceeding limits must return:
  - HTTP 429
  - `error.code` set to `rate_limited`.

---

## 8. Summary

This file defines the core API contracts for Agama.  
Any new endpoint or significant change MUST be reflected here before implementation.
