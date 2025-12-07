# Platform Overview — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Platform Overview  
Last Updated: (update when committed)

This document provides the **high‑depth product and architecture overview** for the Agama platform. It sits directly under `MASTER_SPEC.md` and is intended as:

- The **narrative explanation** of how Agama works end‑to‑end.  
- The main on‑ramp for engineers, designers, and Codex prompts.  
- The bridge between high‑level vision and detailed specs in the other docs (`domain_model.md`, `roles_permissions.md`, `engagement_rooms.md`, etc.).

All changes to the platform’s behaviour MUST be reflected in this file and in `MASTER_SPEC.md`.

---

## 1. What Agama Is

Agama is a **dual‑suite B2B platform** that connects:

- **Vendors** – revenue organisations selling products or services.  
- **Buyers** – procurement and evaluation teams selecting vendors.  

It does this through four tightly‑integrated product surfaces:

1. **RevenueForge (Vendor Suite)**  
   Vendor‑side system of record for accounts, stakeholders, qualification, solution design, competitive strategy, and internal Mutual Action Plans (MAPs).

2. **ProcurePath (Buyer Suite)**  
   Buyer‑side command centre for vendor records, sourcing events, RFX (RFP/RFQ/RFI), evaluation, risk, and approvals.

3. **Engagement Rooms (Collaboration Layer)**  
   Structured collaboration spaces with three views inside one Room:
   - Vendor‑only panels  
   - Shared panels  
   - Buyer‑only panels  

   Guests can join Rooms but see only shared panels.

4. **ValueSphere (Value Engine)**  
   A structured assessment engine used by both vendors and buyers to quantify value, model scenarios, compare options, and produce executive‑level outputs.

The core design principle is:

> **Vendors and buyers each get a first‑class workspace (RevenueForge / ProcurePath), and Engagement Rooms + ValueSphere form the shared, structured collaboration layer between them.** fileciteturn1file0

---

## 2. Core Platform Goals

1. **Unify fragmented tools**  
   Replace separate CRMs, spreadsheets, generic collaboration tools, point‑RFX tools, and ad‑hoc value decks with one coherent platform.

2. **Respect persona boundaries**  
   Vendors must not see buyer‑internal notes and procurement logic. Buyers must not see vendor‑internal revenue intelligence. Shared space is explicit and structured.

3. **Make value and risk explicit**  
   Every major initiative should have structured value, risk, and decision evidence – not buried in email threads and slide decks.

4. **Enable AI without breaking trust**  
   AI should help draft, summarise, and highlight risk and opportunity, but **never** leak private context (vendor‑only → buyer, or buyer‑only → vendor).

5. **Support enterprise‑grade governance**  
   Clear lifecycle states, audit logs, roles, permissions, and integration patterns suitable for large, regulated organisations.

---

## 3. Personas and Suites

Agama has three high‑level personas and two purchasable suites.

### 3.1 Vendor Persona (Seller)

Vendor users belong to a vendor organisation and have **Vendor Suite** entitlement.

They typically include:

- Account Executives  
- Sales / Solution Engineers  
- Customer Success Managers  
- Renewals / Expansion reps  
- Revenue Leaders  

They work primarily in:

- **RevenueForge**  
- **Vendor panels** in Engagement Rooms  
- **Shared panels** in Engagement Rooms  
- **Seller‑mode + shared ValueSphere**

### 3.2 Buyer Persona

Buyer users belong to a buyer organisation and have **Buyer Suite** entitlement.

They typically include:

- Procurement Managers  
- Sourcing Leads  
- Commercial / Finance approvers  
- Legal / InfoSec reviewers  
- Business stakeholders evaluating vendors  

They work primarily in:

- **ProcurePath**  
- **Buyer panels** in Engagement Rooms  
- **Shared panels** in Engagement Rooms  
- **Buyer‑mode + shared ValueSphere**

### 3.3 Guest Persona

Guests are external participants invited into Engagement Rooms via **magic links**:

- No org membership required.  
- No suite entitlements.  
- Access only to **shared panels** in Engagement Rooms.  
- Cannot access RevenueForge or ProcurePath.

They see greyed‑out / upsell areas for:

- Buyer procurement workspace  
- Vendor intelligence workspace  

These act as **bottom‑up PLG conversion levers** for future suite sales. fileciteturn1file0

---

## 4. Product Surfaces in Detail

### 4.1 RevenueForge (Vendor Suite)

**Purpose:** Give vendors a central “account brain” that aggregates intelligence across tools and drives coordinated execution across sales, presales, and CS.

Key functions:

1. **Account 360 (per AgamaAccount)**  
   - CRM sync (Salesforce/HubSpot): account, opportunities, stages, ARR, owner.  
   - Engagement signals: email volume, meeting frequency, Gong call activity, Clari risk.  
   - Health score: computed signal summarising engagement, forecast, and relationship health.  
   - Linked Engagement Rooms and ValueSphere assessments.

2. **Stakeholder Map**  
   - People, roles, influence, sentiment, relationship strength.  
   - Sourced from CRM contacts, calendar invites, and call transcripts (where available).  
   - Used to drive targeting and qualification.

3. **Interaction Timeline**  
   - Unified list of:
     - Emails, meetings, calls, RFX milestones, room events, document actions.  
   - Used for:
     - “What changed since last week?” AI summaries.  
     - Identifying periods of silence or risk.

4. **Qualification & Discovery**  
   - Configurable frameworks (MEDDIC, BANT, custom).  
   - Structured fields attached to Accounts and/or Engagement Rooms.  
   - Drives seller‑side ValueSphere assumptions and risk flags.

5. **Solution & Architecture Design**  
   - Storage for:
     - Draft diagrams  
     - Key assumptions  
     - Technical constraints  
     - Dependencies and risks  
   - Ability to “publish version to Room” into shared architecture panels.

6. **Competitive Landscape**  
   - Known / suspected competitors per Account.  
   - Strengths/weaknesses, landmines, and AI‑suggested counter‑positions.  

7. **Internal Mutual Action Plan (MAP)**  
   - Vendor‑only view of milestones, owners, dates, dependencies.  
   - Some MAP items can be **promoted to shared MAP** inside Engagement Rooms.fileciteturn1file0  

RevenueForge is the **source of truth** for vendor‑side account intelligence. Vendor tabs in Engagement Rooms are **views/editors** backed by RevenueForge data, with explicit controls for what is shared into the Room.

---

### 4.2 ProcurePath (Buyer Suite)

**Purpose:** Give procurement teams a structured command centre for managing sourcing events, evaluating vendors, and governing decisions.

Key functions:

1. **Vendor Records**  
   - Canonical record per vendor (per domain / category).  
   - Contains historic performance, contract links, incidents, risk scores, and prior evaluations.

2. **Sourcing Events**  
   - Represent a discrete initiative (e.g. “Observability Platform Selection 2026”).  
   - Link to:
     - Vendor Records  
     - RFX  
     - Engagement Rooms  
     - Internal stakeholders and approvals  

3. **RFX Management** (see `rfx_framework.md`)  
   - Authoring of structured Rfx objects:
     - Topic area  
     - Sections  
     - Questions (prompt, type, weight, rubric, tags)  
   - Issuance to vendors via Engagement Rooms.  
   - Tracking response status per vendor.

4. **Evaluation & Scorecards**  
   - Capture buyer scoring per question and section.  
   - Use AI to propose draft scores or highlight risks, but keep humans in control.  
   - Aggregate scoring across:
     - Functionality  
     - Security  
     - Commercials  
     - ValueSphere results  
     - Reference checks  

5. **Risk & Compliance**  
   - Track:
     - Security review status (DPA, DPIA, SOC2, etc.)  
     - Financial stability  
     - Regulatory flags  
     - News / incident feeds (future integration).  

6. **Approvals & Governance**  
   - Define approval chains for sourcing events and major decisions.  
   - Track who must sign off, in what order, and what’s currently blocked.

ProcurePath is the **source of truth** for buyer‑side procurement intelligence. Buyer tabs in Engagement Rooms are **deal‑specific windows** into ProcurePath for that vendor and that sourcing event.fileciteturn1file0  

---

### 4.3 Engagement Rooms

**Purpose:** Provide a **structured, shared workspace** where vendor and buyer interact, while preserving each side’s private spaces.

A single Engagement Room contains:

- **Vendor‑only panels** (seller theme, blue/purple)  
  - Vendor Qualification  
  - Internal MAP  
  - Competitive strategy  
  - Internal risk & escalations  
  - Vendor‑view of architecture drafts  
  - Seller‑side ValueSphere  

- **Shared panels** (shared theme, orange)  
  - Overview (scope, objectives, phases, owners, health)  
  - Messages (threaded)  
  - Shared MAP (promoted tasks from both sides)  
  - Shared Architecture Workspace (canvas, comments, versions)  
  - Personas & Business Units (shared understanding)  
  - Docs & Artefacts (versioned, structured folders)  
  - Legal & Commercial (contract drafts, redlines, status)  
  - Shared ValueSphere tab (collaborative assessments)  
  - RFX workspace where buyer issues questions and vendor answers them  

- **Buyer‑only panels** (buyer theme, green)  
  - Internal stakeholders & engagement quality  
  - Procurement timeline (internal milestones aligned with shared MAP)  
  - Evaluation & scoring (RFX, ValueSphere, risks)  
  - Risk & Compliance view  
  - Vendor comparison context (which domain, what other vendors are in the set)  

- **Guest view**  
  - Only shared panels.  
  - Locked/greyed buyer panels with upsell prompts for Buyer Suite.  
  - No vendor‑only or buyer‑only internal insight.fileciteturn1file0  

Rooms are the **conversation and agreement layer** of the platform.

---

### 4.4 ValueSphere

**Purpose:** Provide a reusable, structured language for value and risk conversations.

ValueSphere offers:

- **Templates** – defined by Super Users (vendor and buyer).  
- **Assessments** – instances attached to:
  - Accounts (vendor side)  
  - Vendor Records / Sourcing Events (buyer side)  
  - Engagement Rooms (shared)  

Modes:

1. **Seller Mode**  
   - Used from RevenueForge and vendor tabs in Rooms.  
   - Capture ROI, TCO, productivity, risk reduction, and qualitative value statements.  
   - Drive seller narratives and proposals.

2. **Buyer Mode**  
   - Used from ProcurePath and buyer tabs in Rooms.  
   - Compare vendors on outcomes, risk, and cost.  
   - Structure decision justification.

3. **Shared Mode**  
   - Surface selected scenarios and assumptions in shared Room tabs.  
   - Allow collaborative refinement and sign‑off.

ValueSphere is deeply integrated with RFX (value‑related questions can map to sections of a ValueSphere template).fileciteturn1file0  

---

## 5. Tenancy, Identity, and Roles (High-Level)

Detailed specs live in `MASTER_SPEC.md`, `domain_model.md`, and `roles_permissions.md`. This section summarises what matters for platform understanding.

### 5.1 Tenancy

- **Multi‑tenant SaaS.**  
- Each Organisation = tenant.  
- Core entities carry `orgId` where tenant‑scoped.  
- Cross‑org collaboration **only via Engagement Rooms and invitations**.

### 5.2 Identity

- Identity provider: **WorkOS** (SSO/OAuth).  
- Each `User` can:
  - Belong to zero or more Organisations via `OrganizationMembership`.  
  - Participate in zero or more Engagement Rooms via `RoomParticipant`.  

Guests are represented as Users with special membership/participation rules.

### 5.3 Roles & Entitlements

At a high level:

- Org‑level roles:
  - Org Owner  
  - Org Admin  
  - Standard User  

- Suite entitlements (per membership):
  - Vendor Suite (RevenueForge + vendor panels + seller‑mode ValueSphere)  
  - Buyer Suite (ProcurePath + buyer panels + buyer‑mode ValueSphere)  

- Super Users:
  - Vendor Super User  
  - Buyer Super User  

- Room‑level roles:
  - Vendor user  
  - Buyer user  
  - Guest  

Permissions are enforced as described in `roles_permissions.md`.fileciteturn1file0  

---

## 6. End‑to‑End Flows

This section explains how the major flows hang together conceptually. Implementation detail lives in other docs.

### 6.1 Vendor‑Side Flow (RevenueForge → Engagement Rooms → ValueSphere)

1. Vendor connects integrations (CRM, Gong, Clari, email).  
2. RevenueForge syncs Accounts and interactions → creates/updates `AgamaAccount`.  
3. Vendor user opens an Account:
   - Sees Account 360, stakeholders, timeline, health, qualification, competitive intel.  
4. Vendor user decides to engage buyer more formally:
   - Creates an Engagement Room from that Account.  
   - Invites internal vendor team and external buyer stakeholders (guests or full Buyer Suite users).  
5. Vendor uses vendor tabs to:
   - Refine qualification and internal MAP.  
   - Work on solution & architecture drafts.  
   - Formulate competitive strategy.  
6. Vendor selectively **publishes**:
   - MAP items → Shared MAP  
   - Architecture version → Shared Architecture  
   - Docs → Shared docs  
   - ValueSphere assessment summary → Shared ValueSphere  
7. Conversations and tasks continue in the shared Room, while vendor‑only strategy evolves behind the scenes.

### 6.2 Buyer‑Side Flow (ProcurePath → Engagement Rooms → ValueSphere)

1. Buyer organisation sets up **ProcurePath**:
   - Vendor Records by domain.  
   - Sourcing Events for upcoming initiatives.  

2. For a given Sourcing Event:
   - Buyer creates an Rfx structure (sections, questions, weights).  
   - Vendors are invited (via Rooms) to respond.

3. For each vendor in the event:
   - An Engagement Room instance (or view) is tied to:
     - Buyer Sourcing Event  
     - Buyer VendorRecord  
     - Vendor’s AgamaAccount  

4. Buyer uses buyer‑only tabs to:
   - Coordinate internal stakeholders.  
   - Track procurement timeline.  
   - Score responses and run buyer‑mode ValueSphere.  
   - Evaluate risks and compliance.

5. Shared Room space:
   - Hosts vendor responses, shared documents, shared MAP, and shared ValueSphere discussions.  

6. Buyer eventually:
   - Shortlists vendors.  
   - Uses ValueSphere + scorecards to justify decision.  
   - Finalises approvals and contracts.

### 6.3 Guest Flow

1. Vendor invites buyer contacts as Guests into a Room.  
2. Guests:
   - Authenticate via magic link.  
   - Create a lightweight profile.  
   - See shared tabs only.  

3. UI clearly shows “locked” panels:
   - Procurement Workspace (Buyer Suite)  
   - Evaluation & Risk (Buyer Suite)  

4. Agama uses this as a bottoms‑up lead to sell the Buyer Suite into that buyer org.

---

## 7. Dashboards

Detailed structure in `dashboard_overview.md`. This section explains **why** and **what**, not every widget.

### 7.1 Vendor Dashboard

When a Vendor Suite user logs in:

- **My Accounts**  
  - Accounts ranked by health, risk, recency, or pipeline stage.  

- **My Engagement Rooms**  
  - Rooms needing attention (unread messages, overdue MAP tasks, upcoming milestones).  

- **My Tasks**  
  - Internal + shared tasks drawn from Rooms and RevenueForge MAPs.  

- **Integrations Health**  
  - CRM / Gong / Clari / email sync status, errors, and warnings.  

- **AI Suggestions**  
  - Accounts at risk (low engagement, negative signals).  
  - Stakeholders with no recent contact.  
  - Recommended next steps per key deals.

### 7.2 Buyer Dashboard

When a Buyer Suite user logs in:

- **Active Sourcing Events**  
  - Status, phase, time‑to‑decision.  

- **Evaluation Progress**  
  - Vendors awaiting scoring, sections not yet evaluated.  

- **Approvals**  
  - Items requiring the user’s sign‑off.  

- **Vendor Risk Overview**  
  - Risk levels across current events.  

- **AI Insights**  
  - Vendors with outstanding security/commercial concerns.  
  - Suggested comparisons worth a leadership review.

### 7.3 Guest Dashboard

When a Guest logs in:

- **Rooms I’m In**  
  - List of Rooms and shared activity.  

- **My Shared Tasks**  
  - Tasks assigned in shared MAP.  

- **What’s New**  
  - Important shared changes (new docs, new milestones).  

Plus: clearly visible **upgrade prompts** to the Buyer Suite (for procurement‑like guests) or Vendor Suite (for vendors who enter as guests before full onboarding).

---

## 8. Integrations (Conceptual)

Details in `integrations.md`. From a platform overview perspective:

- **Vendor integrations**  
  - CRM (Salesforce/HubSpot)  
  - Gong (calls/transcripts)  
  - Clari (forecast/risk)  
  - Email & calendar (Google/Microsoft)  

- **Buyer integrations**  
  - Procurement ERPs  
  - Contract management systems  
  - Risk / compliance data feeds  

- **Identity**  
  - WorkOS for SSO, SCIM (later), and directory sync.

Integrations feed into the relevant suites (RevenueForge / ProcurePath) and, through them, into Engagement Rooms and ValueSphere. They are NOT wired directly to Rooms without going via suite logic.

---

## 9. Collaboration & AI (Conceptual)

### 9.1 Collaboration Engine

- Real‑time messaging in Rooms.  
- Real‑time updates to:
  - Shared MAP  
  - Tasks  
  - Selected docs / architecture canvases  

- Presence indicators and typing indicators.  
- Backed by WebSockets or SSE, with MongoDB as source of truth.

Details in `collaboration_engine.md`.

### 9.2 AI Usage

AI is used to:

- Summarise account or room activity.  
- Suggest qualification updates and next steps.  
- Draft RFX responses (vendor side).  
- Propose evaluation notes or highlight risks (buyer side).  
- Summarise and structure ValueSphere assessments.

AI must **never** cross vendor‑only / buyer‑only boundaries when generating content for the other side. Detailed context rules and prompt design are in `ai_context_model.md` (referenced from `MASTER_SPEC.md`). fileciteturn1file0  

---

## 10. Integration Topology (System-Wide)

Agama operates as a multi-surface platform with clear data ownership boundaries:

- RevenueForge owns vendor intelligence and pushes selected artefacts into Engagement Rooms.
- ProcurePath owns buyer intelligence and pushes selected artefacts into Engagement Rooms.
- Engagement Rooms never store deep business logic; they host collaboration artefacts only.
- ValueSphere operates in all modes (seller, buyer, shared) depending on entry context.
- RFX always originates from ProcurePath; vendors interact with it exclusively through Rooms.
- Search traverses all surfaces but applies visibility rules strictly during indexing and query time.
- Notifications originate from events across all suites; delivery is governed by visibility and role.

This topology ensures:
- Each suite remains authoritative for its domain data.
- All cross-suite interaction happens only through clearly defined interfaces.
- Visibility boundaries are preserved at all times.

## 11. Failure Modes & Recovery Expectations

Agama must gracefully handle failures without data loss:

- Temporary integration failures should:
  - Surface clear UI warnings.
  - Retry via exponential backoff.
  - Never block core suite operations.
- Engagement Room real-time failures must:
  - Fall back to REST polling.
  - Gracefully degrade collaboration features.
- AI service failures must:
  - Fail closed (safe), not open (leaky).
  - Provide user-facing fallback text explaining limited context or unavailable suggestions.
- RFX issuance or submission failures must:
  - Retry automatically when network recovers.
  - Never duplicate submissions.
- All errors must be logged with:
  - userId
  - orgId
  - action attempted
  - timestamp
  - correlationId (for observability systems)

---

## 12. Cross-Surface Data Ownership

- RevenueForge owns vendor intelligence.
- ProcurePath owns buyer intelligence.
- Engagement Rooms own shared collaboration artefacts.
- ValueSphere owns templates and assessments by mode.
- RFX owns its own structure, scoring, and evaluation data.

No surface may mutate data owned by another surface except through explicit publishing paths.

---

## 13. How This Document Relates to Others

- `MASTER_SPEC.md`  
  - Canonical top‑level spec (vision, roles, rules of the system).  

- `platform_overview.md` (this file)  
  - Narrative explanation of how the system works as a whole.  

- `domain_model.md`  
  - Detailed schemas, relationships, IDs, indexes, and lifecycle enums.  

- `roles_permissions.md`  
  - Full matrix of roles vs features vs scopes.  

- `revenueforge.md`, `procurepath.md`, `engagement_rooms.md`, `valuesphere.md`, `rfx_framework.md`  
  - Deep dives per product surface.  

- `notifications.md`, `search_architecture.md`, `user_invitation.md`, `user_profile.md`, `collaboration_engine.md`, `audit_and_governance.md`, `integrations.md`, `future_migration.md`  
  - Cross‑cutting concerns and technical architecture.

All Codex prompts that change architecture or behaviour MUST rely on this stack of docs, starting from `MASTER_SPEC.md` and `platform_overview.md` for context.

---

**End of platform_overview.md**  