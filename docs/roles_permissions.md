# roles_permissions.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Role & Permission Specification  
Last Updated: (update before commit)

This document defines the complete **Roles, Permissions, and Entitlements** model for Agama Technologies.  
All backend logic, frontend visibility conditions, and Codex-generated components MUST strictly follow this specification.

If any file disagrees with this one, this document wins, except where explicitly overridden by `MASTER_SPEC.md`.

---

## 1. Overview of Agama’s Permission System

Agama's permission model is built on **three stacked layers**, each adding constraints:

1. **Organisation-Level Roles** (governance & configuration)  
2. **Suite Entitlements** (Vendor Suite / Buyer Suite)  
3. **Room-Level Roles** (Vendor User / Buyer User / Guest)

In addition:

- **Super Users** extend suite capabilities.  
- **Visibility modes** (`vendor_only`, `buyer_only`, `shared`) apply to data.  
- **AI contexts** must respect these boundaries.  
- **Cross-org collaboration** is ONLY allowed through Engagement Rooms.

The permission system is **orthogonal**: org roles, suite entitlements, and room roles are independent axes that combine to determine effective permissions.

---

## 2. Organisation-Level Roles

Every Organisation has three structural roles:

| Org Role        | Description                          | Permissions Summary                                                |
|-----------------|--------------------------------------|--------------------------------------------------------------------|
| org_owner       | Ultimate authority; billing + governance | Full access to org settings, billing, seat management, role assignment |
| org_admin       | Operational admin; manages users     | Manage memberships, assign suites, assign Super Users              |
| user            | Normal user                          | Permissions driven by Vendor/Buyer suite entitlements             |

### 2.1 Org Owner

Responsibilities:

- Full billing access:
  - View and manage invoices, payment methods, subscription plans.  
- Manage Org Admins:
  - Promote/demote Org Admins.  
- Manage suite entitlements:
  - Configure Vendor Suite / Buyer Suite seat allocation.  
- Manage Super Users:
  - Assign/revoke Vendor Super Users, Buyer Super Users.  
- Configure organisation-wide integrations:
  - CRM, Gong, Clari, email/calendar, procurement ERP.  
- Access organisation-wide reporting and analytics.

Restrictions:

- An organisation must always have **at least one** `org_owner`.  
- Ownership transfer must be explicit and auditable (log in `AuditLog`).

### 2.2 Org Admin

Responsibilities:

- Invite/suspend users.  
- Assign Vendor Suite / Buyer Suite entitlements.  
- Assign or revoke Vendor/Buyer Super Users.  
- Configure departments/teams.  
- View licence usage (seats consumed vs available).  
- View non-sensitive activity metrics.

Restrictions:

- Cannot change billing unless explicitly granted billing privileges by Org Owner.  
- Cannot modify org ownership.

### 2.3 Standard User (`role = user`)

Responsibilities:

- Operate within their assigned suite(s) (Vendor / Buyer / Dual).  
- Work on Rooms, RFX, ValueSphere, etc., as permitted.

Restrictions:

- No access to global organisation configuration.  
- No access to user management or seat allocation.  
- No access to billing.

---

## 3. Suite Entitlements

Suite entitlements control which **product surfaces** a user can access inside an organisation.

### 3.1 Vendor Suite

When `entitlements.vendorSuite = true` in `OrganizationMembership`:

The user is a **Vendor Suite user** and can:

- Access **RevenueForge**.  
- Access **vendor-only panels** inside Engagement Rooms.  
- Access **shared panels** inside Engagement Rooms.  
- Use **seller-mode ValueSphere**.  
- Create and manage Engagement Rooms (from vendor side).  
- Invite buyers (guests or Buyer Suite orgs) into Rooms.  

They **cannot** access:

- ProcurePath (buyer-side workspace).  
- Buyer-only panels.  
- Buyer-mode ValueSphere.

### 3.2 Buyer Suite

When `entitlements.buyerSuite = true`:

The user is a **Buyer Suite user** and can:

- Access **ProcurePath**.  
- Access **buyer-only panels** inside Engagement Rooms.  
- Access **shared panels** inside Engagement Rooms.  
- Use **buyer-mode ValueSphere**.  
- Create and manage **Sourcing Events** and **RFX**.  
- Perform evaluations, scoring, and approvals.

They **cannot** access:

- RevenueForge (vendor-side workspace).  
- Vendor-only panels.  
- Seller-mode ValueSphere.

### 3.3 Dual Suite

When both `vendorSuite = true` and `buyerSuite = true`:

The user is a **Dual-Suite user**.

Behaviour:

- In vendor org context and vendor Rooms:
  - Appears as a Vendor Suite user.  
- In buyer org context and buyer Rooms:
  - Appears as a Buyer Suite user.  

They must **never** see cross-org internal data accidentally; room role and org context still control visibility.

---

## 4. Super Users

Super Users are advanced users with configuration powers for their respective suites.

### 4.1 Vendor Super User

Identifier: `superUser.vendor = true` on `OrganizationMembership`.

Permissions:

- Configure vendor-side integrations:
  - CRM, Gong, Clari, email/calendar.  
- Manage vendor-side templates:
  - Qualification frameworks (MEDDIC/BANT/CUSTOM).  
  - Seller-mode ValueSphere templates.  
  - Competitive intel libraries.  
  - Architecture template libraries.  
- Manage vendor-side AI configuration:
  - Which contexts are allowed.  
  - Prompt presets for seller AI features.  

No privileges to:

- Billing.  
- Organisation-level role changes.  
- Buyer-side templates or workflows.

### 4.2 Buyer Super User

Identifier: `superUser.buyer = true`.

Permissions:

- Configure buyer-side integrations:
  - Procurement ERPs, contract tools, risk feeds.  
- Manage buyer-side templates:
  - RFX templates (sections, questions, weights, rubrics).  
  - Buyer-mode ValueSphere templates.  
  - Scorecards and evaluation schemes.  
  - Risk matrices and vendor taxonomy.  
- Manage buyer-side AI configuration:
  - Evaluation assistance, risk detection prompts, etc.

No privileges to:

- Billing.  
- Organisation-level role changes.  
- Vendor-side templates or workflows.

---

## 5. Room-Level Roles (Engagement Rooms)

Inside each **EngagementRoom**, a user has a `RoomParticipant.role`:

- `vendor_user`  
- `buyer_user`  
- `guest`

These roles control which panels and data the user sees in that Room.

### 5.1 Vendor User in Room (`role = vendor_user`)

Permissions within a Room:

- Access **Vendor Panels**:
  - Vendor qualification view and edit.  
  - Vendor internal MAP (if surfaced within room context).  
  - Vendor architecture drafts.  
  - Competitive strategy (internal).  
  - Seller-mode ValueSphere (if associated with the Room and `visibility != buyer_only`).  

- Access **Shared Panels**:
  - Shared Overview.  
  - Messages (chat/threads).  
  - Shared MAP.  
  - Shared Architecture Workspace (published versions).  
  - Shared Documents.  
  - Shared ValueSphere.  
  - RFX answering view (respond to buyer questions).

Cannot access:

- Buyer-only panels:
  - Internal procurement views.  
  - Internal buyer scoring / risk sections.  
  - Buyer-only ValueSphere.

### 5.2 Buyer User in Room (`role = buyer_user`)

Permissions within a Room:

- Access **Buyer Panels**:
  - Internal stakeholders view, engagement quality.  
  - Procurement timeline (internal milestones).  
  - Evaluation & scoring panels.  
  - Buyer-only risk & compliance view.  
  - Buyer-mode ValueSphere attached to vendor/service.  
  - Vendor comparison context (which other vendors are in this event).

- Access **Shared Panels**:
  - Shared Overview.  
  - Messages (chat/threads).  
  - Shared MAP.  
  - Shared Architecture Workspace.  
  - Shared Documents.  
  - Shared ValueSphere.  
  - RFX workspace (create/edit questions before issuance; view vendor responses; run comparisons).

Cannot access:

- Vendor-only panels:
  - Internal vendor qualification.  
  - Vendor competitive strategy.  
  - Vendor internal MAP.  
  - Vendor-only ValueSphere details.

### 5.3 Guest in Room (`role = guest`)

Permissions:

- Access **Shared Panels ONLY**:
  - Shared Overview.  
  - Messages (shared).  
  - Shared MAP.  
  - Shared Documents.  
  - Shared Architecture.  
  - Shared ValueSphere (if explicitly shared).  
  - RFX response form (if they are acting as vendor guest, e.g. one-person start-up with vendor role but no full Vendor Suite yet).

Cannot:

- Access vendor-only panels.  
- Access buyer-only panels.  
- See RFX scoring, buyer evaluation, or internal vendor intel.  
- Configure integrations or templates.  

Guests see:

- Greyed/locked panels with clear upsell CTAs like:
  - “Unlock Procurement Workspace with Agama Buyer Suite.”  
  - “Unlock Revenue Workspace with Agama Vendor Suite.”

---

## 6. Visibility Modes for Data

Visibility is baked into several key entities: `Qualification`, `ArchitectureDesign`, `RoomTimelineEvent`, ValueSphere assessments, etc.

### 6.1 `vendor_only`

Visible only to:

- Vendor Suite users of the vendor org (and Org Owner/Admin where appropriate).  

Not visible to:

- Buyer users.  
- Guests.  
- AI when generating buyer-visible content.

Use cases:

- Internal qualification.  
- Internal vendor MAP tasks.  
- Competitive intel.  
- Internal risk & escalation notes.

### 6.2 `buyer_only`

Visible only to:

- Buyer Suite users of the buyer org (and relevant governance roles).  

Not visible to:

- Vendor users.  
- Guests.  
- AI when generating vendor-visible content.

Use cases:

- Evaluation scoring.  
- Risk and compliance comments.  
- Internal procurement notes and approvals.

### 6.3 `shared`

Visible to:

- Vendor Suite users (room participants).  
- Buyer Suite users (room participants).  
- Guests (room participants).

Use cases:

- Shared MAP tasks.  
- Shared docs and architecture.  
- Shared ValueSphere sections.  
- RFX questions and vendor answers (but not scoring).  

---

## 7. Feature-Level Permission Matrix

### 7.1 Organisation & Admin Features

| Feature                                | Org Owner | Org Admin | Vendor Super User | Buyer Super User | Standard User |
|----------------------------------------|-----------|-----------|-------------------|------------------|---------------|
| View billing                           | ✔         | (optional, if enabled) | ✖                 | ✖                | ✖             |
| Change plan                            | ✔         | ✖         | ✖                 | ✖                | ✖             |
| View seat usage                        | ✔         | ✔         | ✖                 | ✖                | ✖             |
| Invite users                           | ✔         | ✔         | ✖                 | ✖                | ✖             |
| Suspend users                          | ✔         | ✔         | ✖                 | ✖                | ✖             |
| Assign Vendor Suite / Buyer Suite      | ✔         | ✔         | ✖                 | ✖                | ✖             |
| Assign Super Users                     | ✔         | ✔         | ✖                 | ✖                | ✖             |
| Configure org-level integrations       | ✔         | ✔         | ✖                 | ✖                | ✖             |
| Configure vendor suite templates       | ✖         | ✖         | ✔                 | ✖                | ✖             |
| Configure buyer suite templates        | ✖         | ✖         | ✖                 | ✔                | ✖             |

---

### 7.2 RevenueForge (Vendor Suite)

| Feature                                     | Vendor User | Buyer User | Guest |
|---------------------------------------------|-------------|------------|-------|
| Access RevenueForge UI                      | ✔           | ✖          | ✖     |
| View Accounts (AgamaAccount)                | ✔           | ✖          | ✖     |
| View account stakeholders                   | ✔           | ✖          | ✖     |
| Edit stakeholders                           | ✔           | ✖          | ✖     |
| View interaction timeline                   | ✔           | ✖          | ✖     |
| Edit qualification (vendor_only or shared)  | ✔           | ✖          | ✖     |
| View competitive intel                      | ✔           | ✖          | ✖     |
| Edit competitive intel                      | ✔           | ✖          | ✖     |
| Create internal MAP                         | ✔           | ✖          | ✖     |
| Publish MAP items to shared MAP in Room     | ✔           | ✖          | ✖     |
| Create Engagement Room from Account         | ✔           | ✖          | ✖     |

---

### 7.3 ProcurePath (Buyer Suite)

| Feature                                     | Vendor User | Buyer User | Guest |
|---------------------------------------------|-------------|------------|-------|
| Access ProcurePath UI                       | ✖           | ✔          | ✖     |
| Manage Vendor Records                       | ✖           | ✔          | ✖     |
| View Vendor Records                         | ✖           | ✔          | ✖     |
| Create Sourcing Events                      | ✖           | ✔          | ✖     |
| Create/Issue RFX                            | ✖           | ✔          | ✖     |
| Edit RFX (pre-issue)                        | ✖           | ✔          | ✖     |
| Score RFX responses                         | ✖           | ✔          | ✖     |
| View internal evaluation dashboards         | ✖           | ✔          | ✖     |
| Configure approval chains                   | ✖           | ✔ (if Super User or Admin) | ✖ |

---

### 7.4 Engagement Rooms

| Feature                                         | Vendor User | Buyer User | Guest |
|-------------------------------------------------|-------------|------------|-------|
| Access Room                                     | ✔           | ✔          | ✔     |
| View vendor-only panels                         | ✔           | ✖          | ✖     |
| View buyer-only panels                          | ✖           | ✔          | ✖     |
| View shared panels                              | ✔           | ✔          | ✔     |
| Post messages (shared)                          | ✔           | ✔          | ✔     |
| Create shared MAP tasks                         | ✔           | ✔          | ✔     |
| Edit shared MAP tasks                           | ✔ (if owner or allowed) | ✔ (if owner or allowed) | limited (if allowed) |
| Upload shared documents                         | ✔           | ✔          | ✔ (subject to config) |
| View shared documents                           | ✔           | ✔          | ✔     |
| View RFX questions                              | ✔           | ✔          | ✔ (if appropriate) |
| Answer RFX questions (vendor)                   | ✔ (vendor)  | ✖          | ✔ (if guest vendor) |
| View RFX scoring                                | ✖           | ✔          | ✖     |
| Use seller-mode ValueSphere in Room             | ✔           | ✖          | ✖     |
| Use buyer-mode ValueSphere in Room              | ✖           | ✔          | ✖     |
| View shared ValueSphere in Room                 | ✔           | ✔          | ✔     |

---

## 8. AI Permission Rules

AI is a **helper**, not a super-user. It must always obey the same visibility rules as the user on whose behalf it is acting.

### 8.1 Vendor-Only Context Must Not Leak

Vendor-only context includes:

- Internal qualification fields flagged `vendor_only`  
- Internal MAP tasks not published to shared MAP  
- Competitive intel records  
- Vendor-only ValueSphere responses  
- Internal vendor risk notes  

AI must **NOT**:

- Use vendor-only context when generating buyer-visible summaries, messages, or docs.  
- Use vendor-only context when generating shared ValueSphere content.

Example:  
AI cannot suggest “Buyer is also considering Competitor X and is weak on feature Y” in a shared context if that knowledge was from vendor-only intel.

### 8.2 Buyer-Only Context Must Not Leak

Buyer-only context includes:

- RFX scoring  
- Evaluation notes  
- Buyer-only ValueSphere assessments  
- Internal risk & compliance notes  
- Shortlist decisions  

AI must **NOT**:

- Disclose scores or rankings in vendor-facing content.  
- Disclose shortlist status until/if buyer explicitly shares it.

Example:  
AI cannot tell the vendor “You are currently ranked 3rd of 5 vendors” in vendor-visible content.

### 8.3 Shared Context is Safe

AI may freely use:

- Shared docs  
- Shared MAP items  
- Shared ValueSphere fields  
- RFX questions & vendor answers  
- Shared timeline events  

Example:  
AI summarising “What has happened in this Room in the last 2 weeks?” for a shared overview can use only shared and public Room data.

### 8.4 Hard Fail Behaviour

If a requested AI operation would require combining vendor-only and buyer-only data in a single output, AI should:

- Decline the operation gracefully.  
- Or restrict itself to allowed contexts and explicitly state that certain information is not available.

---

## 9. RFX Permissions in Detail

### 9.1 Vendor-Side

Vendors can:

- View all RFX questions issued to them in a Room.  
- Answer questions, including attaching documents.  
- Edit answers until the RFX response window closes (depending on buyer settings).  

Vendors cannot:

- View buyer scoring or comparison dashboards.  
- See internal buyer comments (on answers or sections).  
- See other vendors’ responses.  
- Modify the RFX structure.

### 9.2 Buyer-Side

Buyers can:

- Create and edit RFX (before issuance).  
- Issue RFX (moves status from `draft` to `issued`).  
- View all responses from each vendor.  
- Score responses, add internal comments, and use AI suggestions.  
- Create and view aggregated RfxEvaluation data.  

Buyers cannot:

- Modify vendor responses (they may attach internal commentary separately).  
- See internal vendor-only content (e.g., their RevenueForge notes).

### 9.3 Guests

Guests can:

- Answer RFX questions **if** acting as vendor-seated guests (e.g., early-stage vendor evaluation where they don’t yet have Vendor Suite).  
- View only shared elements of the RFX and Room.

Guests cannot:

- Create or edit RFX.  
- View scoring, internal buyer notes, or comparisons.  

---

## 10. ValueSphere Permissions in Detail

### 10.1 Seller-Mode ValueSphere

Visible and editable by:

- Vendor Suite users (with appropriate org membership).  

Not visible to:

- Buyers, unless a subset of fields is explicitly shared or summarised into a shared ValueSphere.

### 10.2 Buyer-Mode ValueSphere

Visible and editable by:

- Buyer Suite users in the buyer org.  

Not visible to:

- Vendors.  
- Guests.

### 10.3 Shared-Mode ValueSphere

Visible to:

- Vendor participants in the Room.  
- Buyer participants in the Room.  
- Guests (if configured).

Shared-mode assessments must contain only content suitable for cross-org exposure.

---

## 11. Document & File Permission Rules

### 11.1 Room Documents

Room documents (`RoomDocument`) are **inherently shared**:

- Both vendor and buyer see them.  
- Guests see them (subject to feature flags).  

Internal-only docs:

- Vendor-only documents live in vendor-side systems (e.g., RevenueForge).  
- Buyer-only documents live in ProcurePath.

### 11.2 Version Control

- All versions of a RoomDocument remain shared.  
- Changes must be logged in `RoomDocumentVersion` and `AuditLog`.  
- Internal-only edits should happen on suite-side documents, not shared Room docs.

---

## 12. Tenancy & Cross-Org Enforcement

Every tenant-scoped entity includes an `orgId`.  
Enforcement rules:

- Vendor org never sees buyer’s `buyer_only` data.  
- Buyer org never sees vendor’s `vendor_only` data.  
- Shared objects in Rooms cross the boundary by design and must be clearly identified.  
- Whenever data is synchronised between vendor-side `AgamaAccount` and buyer-side `VendorRecord`, that mapping must be explicit and auditable.

---

## 13. Edge Cases & Scenarios

### 13.1 User in Multiple Organisations

If a user belongs to multiple orgs:

- Their permissions depend on the **current org context** they select.  
- Suite entitlements are per `OrganizationMembership`.  
- A user might be a Vendor User in one org and a Buyer User in another.

### 13.2 Guest Converted to Full Buyer Org

If a buyer who started as a guest in a Room later onboards as a Buyer Suite customer:

- Their `User` remains the same.  
- A new `OrganizationMembership` is created for their buyer org.  
- Their RoomParticipant role can change from `guest` → `buyer_user` (for Rooms mapped to that org).  
- They instantly gain access to buyer-only panels in Rooms they are a participant of, if mapping matches.

### 13.3 AI Request that Crosses Boundaries

Example: Vendor asks:  
“Summarise how we’re being scored compared to other vendors.”

AI must:

- NOT access buyer-only scores.  
- Either refuse or answer generically (e.g., “That information is not available to you.”).

---

## 14. Backend Enforcement Guidelines

For every request that touches data:

1. **Authenticate** the user.  
2. **Determine org context**:
   - For org-scoped operations, ensure membership in that org.  
3. **Load OrganizationMembership**:
   - Fetch roles, entitlements, superUser flags.  
4. **For Room operations**:
   - Fetch `RoomParticipant` for `(roomId, userId)` if required.  
   - Check `role` (vendor_user / buyer_user / guest).  
5. **Check suite entitlements**:
   - If feature is vendor-side only → require `vendorSuite`.  
   - If feature is buyer-side only → require `buyerSuite`.  
6. **Apply visibility rules**:
   - If object is `vendor_only` → block if user is not vendor-side.  
   - If object is `buyer_only` → block if user is not buyer-side.  
7. **Log critical operations** to `AuditLog`.

If any check fails, return `403 Forbidden` with a clear reason.

---

## 15. Temporal Permissions

Certain permissions must change over time:

- When a Room transitions to `closed`:
  - Vendor and buyer users retain read-only access.
  - Guests lose access unless explicitly extended.
  - New tasks, documents, or messages cannot be created.
- When an RFX transitions to `closed`:
  - Vendors become read-only.
  - Buyers retain scoring and justification views.

Codex must enforce time-based rules automatically at Room and RFX boundaries.

## 16. Data Export Permissions

Only the following roles may export data:

- org_owner
- org_admin
- buyer_user (exporting buyer-only evaluations)
- vendor_user (exporting seller-only qualification summaries)
- Room participants (exporting shared-only data)

Exports must:

- Respect all visibility rules
- Obfuscate private vendor/buyer fields
- Log the export in AuditLog

---

## 17. Summary

This file defines:

- Org-level roles (Org Owner, Org Admin, Standard User).  
- Suite entitlements (Vendor Suite, Buyer Suite, Dual).  
- Super User roles (Vendor Super User, Buyer Super User).  
- Room-level roles (Vendor User, Buyer User, Guest).  
- Visibility modes (`vendor_only`, `buyer_only`, `shared`).  
- Feature-level access rules across RevenueForge, ProcurePath, Engagement Rooms, RFX, and ValueSphere.  
- AI and data-leakage rules.  
- Tenancy and cross-org boundaries.  
- Enforcement patterns for backend services.

All future features MUST be mapped explicitly onto this model, or this file must be updated first.

---

**End of roles_permissions.md**
