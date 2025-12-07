# Agama MASTER SPEC

Version: 1.1  
Owner: Agama Technologies  
Last Updated: (update when you paste)

This is the **authoritative specification** for the Agama platform.  
All other documents in `/docs` **must remain consistent with this file**.  
If there is a conflict, **this document wins**.

---

## 1. Purpose and Vision

Agama is an enterprise platform that unifies:

- **Vendor-side** sales / presales / customer success execution.  
- **Buyer-side** procurement, sourcing, and vendor evaluation.  
- **Shared collaboration** between vendors and buyers around deals, projects, and sourcing events.  
- **Structured value conversations** and questionnaires that quantify business impact for both sides.

Agama delivers this via four main product surfaces:

- **RevenueForge** – Vendor Suite: account intelligence, qualification, solution design, and internal Mutual Action Plans (MAP).  
- **ProcurePath** – Buyer Suite: procurement workflows, vendor records, sourcing events, RFX, risk, and approvals.  
- **Engagement Rooms** – shared collaboration surface with vendor-only, shared, and buyer-only tabs.  
- **ValueSphere** – structured value assessments and questionnaires used in seller, buyer, and shared modes.

The long-term vision is:

- For **sellers**: a unified brain for account intelligence, collaboration, and value storytelling that aggregates data across tools (CRM, Gong, Clari, email, calendar, etc.).  
- For **buyers**: a first-class procurement system to centralise vendor insights, compare options, run structured evaluations, and capture a defensible decision record.  
- For **both**: a shared, structured collaboration environment (Engagement Rooms) where value, requirements, documents, and timelines stay aligned.

---

## 2. Suites and Products

### 2.1 Vendor Suite (Seller Suite)

For vendor-side users (sales, presales, CS). The Vendor Suite includes:

- **RevenueForge** – vendor-side account intelligence, qualification, stakeholder mapping, solution and architecture design, competitive analysis, and internal MAP.  
- **Vendor panels in Engagement Rooms** – internal qualification, internal MAP, competitive views, architecture drafts, seller-side ValueSphere, internal risks and notes.  
- **Access to shared panels in Engagement Rooms** – messaging, shared MAP, shared docs, architecture canvas, shared ValueSphere, shared RFX surfaces.  
- **Seller-mode ValueSphere** – tools to capture ROI/TCO/value narratives and turn discovery into quantified business outcomes.

Key responsibilities of the Vendor Suite:

- Ingest and unify vendor-side intelligence from external systems.  
- Enable internal coordination across sales, presales, CS, and leadership.  
- Provide a controlled way to **publish selected intelligence** into shared collaboration with buyers.  
- Support AI-driven insight and recommendations while respecting permissions.

### 2.2 Buyer Suite

For buyer-side users (procurement, sourcing, commercial, finance, security, legal).

The Buyer Suite includes:

- **ProcurePath** – vendor records, sourcing events, RFX authoring, risk analysis, approvals, and decision documentation.  
- **Buyer panels in Engagement Rooms** – evaluation, scoring, risk views, approvals, procurement timelines, and vendor comparison context.  
- **Access to shared panels in Engagement Rooms** – messaging, shared MAP, docs, architecture, shared ValueSphere, and RFX response collaboration.  
- **Buyer-mode ValueSphere** – structured value and risk models, vendor comparisons, scenario analysis, and justification artefacts.

Key responsibilities of the Buyer Suite:

- Centralise procurement workflows across vendors and domains.  
- Drive structured evaluations that are transparent and repeatable.  
- Provide clear, auditable decision paths and risk justifications.  
- Support AI-assisted evaluation and comparison of vendor responses.

### 2.3 Engagement Rooms

**Engagement Rooms** are the central collaboration unit of Agama.

They:

- Link a **vendor organisation** to one or more **buyer organisations** and/or **vendor records**.  
- Provide three surfaces in a single room model:
  - **Vendor-only tabs** (seller theme – blue/purple).  
  - **Shared tabs** (shared theme – orange).  
  - **Buyer-only tabs** (buyer theme – green).  
- Are used for:
  - Ongoing sales cycles and evaluation processes.  
  - Procurement events and RFX responses.  
  - Post-sale initiatives (e.g. expansion projects, renewals, complex delivery phases).

**Guests** can join rooms via invitations, but:

- They only see **shared tabs**.  
- They never see vendor-only or buyer-only internal content.  
- The UI surfaces **upsell prompts** to convert guest usage into full Buyer or Vendor Suite customers.

### 2.4 ValueSphere

**ValueSphere** is a structured assessment and questionnaire engine:

- **Seller mode** – quantify and communicate the value and impact of the vendor solution, from a seller perspective.  
- **Buyer mode** – allow buyers to compare vendors on value, risk, and fit, using a structured and repeatable framework.  
- **Shared mode** – collaborative refinement of assumptions, metrics, scenarios, and business cases between seller and buyer.

ValueSphere supports:

- Templates with sections, questions, and weights.  
- Both numeric and qualitative answers.  
- Attachments and references.  
- AI assistance for drafting answers, summarising assessments, and suggesting scenarios.  
- Integration with RFX questions where appropriate (e.g. value-related questions).

---

## 3. Tenancy and Identity

### 3.1 Multi-Tenant Model

- Agama is a **single logical multi-tenant** SaaS deployment.  
- Each **Organisation** is a tenant.  
- All tenant-scoped domain objects include an `orgId` field or equivalent reference.  
- Cross-org collaboration is allowed **only** via:
  - Engagement Rooms.  
  - Invitation flows (internal users and guests).  

Isolation rules:

- Vendor data from one organisation is never visible to another organisation **unless** explicitly shared via an Engagement Room and marked as **shared** data.  
- Buyer data remains isolated within each buyer organisation. Vendors only see **shared** subsets of information.  
- Underlying storage may be shared (MongoDB collections) but must enforce `orgId`-scoped queries and access control.

### 3.2 Identity and Authentication

- Identity provider: **WorkOS** (SSO and OAuth).  
- Support:
  - Enterprise SSO (Okta, Azure AD, etc.) via WorkOS.  
  - Passwordless / magic link for smaller tenants and guests (aligned or proxied via WorkOS where possible).  

Each **User** has:

- A global `User` record (anchor identity).  
- Zero or more `OrganizationMembership` records.  
- Zero or more `RoomParticipant` records across Engagement Rooms (which may span organisations).

Authentication principles:

- Auth tokens must identify:
  - `userId`
  - Current `orgContext` (if applicable)
  - Session expiry and scopes

### 3.3 Authorisation

Authorisation is **role-based** and **resource-scoped**.

Key axes:

- Org-level roles:
  - `org_owner`
  - `org_admin`
  - `user` (standard)
- Suite entitlements (per OrganisationMembership):
  - `vendorSuite: boolean`
  - `buyerSuite: boolean`
- Super-user flags:
  - `superUser.vendor: boolean`
  - `superUser.buyer: boolean`
- Room-level roles:
  - `vendor_user`
  - `buyer_user`
  - `guest`
- Contextual permissions:
  - Ownership and visibility attributes on entities:
    - `visibility: vendor_only | buyer_only | shared`
    - RFX visibility per vendor.
    - ValueSphere visibility mode.

**Access decisions must always check**:

1. User identity (authenticated principal).  
2. Organisation membership and suite entitlements.  
3. Room participation and role (for Engagement Room–scoped actions).  
4. Entity ownership and visibility flags (e.g. `shared` vs `vendor_only` vs `buyer_only`).  
5. Any additional business rules (e.g. only Buyers can issue RFX, only Vendors can submit RFX answers).

Implementation detail: see `roles_permissions.md` for full matrix and enforcement approach.

---

## 4. Roles and Permissions (Summary)

> Full detailed matrix lives in `roles_permissions.md`.  
> This section is the canonical summary.

### 4.1 Org-Level Roles

- **Org Owner**
  - Ultimate control over organisation settings and billing.  
  - Can assign and revoke Org Admins.  
  - Can purchase and manage suite entitlements (Vendor Suite, Buyer Suite).  
  - Can configure high-level integrations and security controls.

- **Org Admin**
  - Manage users within the org (invite, suspend, change roles).  
  - Assign suite entitlements (Vendor Suite / Buyer Suite) to users.  
  - Grant or revoke Super User roles.  
  - View seat usage and licence consumption.  
  - By default, cannot view billing details unless explicitly given that right.

### 4.2 Suite-Level Roles

- **Vendor Super User**
  - Configures CRM, Gong, Clari, email/calendar, and other vendor-side integrations.  
  - Manages RevenueForge templates, including:
    - Qualification frameworks (MEDDIC, BANT, custom).  
    - Competitive intel assets.  
    - Account plan templates.  
  - Manages seller-mode ValueSphere templates.  
  - Administers vendor-focused AI settings and prompt contexts.

- **Buyer Super User**
  - Configures procurement integrations (ERP, contract systems, risk feeds).  
  - Manages RFX templates (sections, questions, weights, rubrics).  
  - Manages buyer-mode ValueSphere templates.  
  - Defines evaluation scorecards, risk matrices, and approval workflows.  
  - Administers buyer-focused AI settings and evaluation models.

### 4.3 Standard Users

- **Vendor Suite User**
  - Access to:
    - RevenueForge.  
    - Vendor-only tabs in Engagement Rooms.  
    - Shared tabs in Engagement Rooms.  
    - Seller-mode and shared ValueSphere (where permitted).  
  - Can:
    - Create and manage Engagement Rooms (vendor side).  
    - Sync their own email/calendar where enabled.  
    - Work on assignments across accounts, rooms, tasks, and RFX responses.

- **Buyer Suite User**
  - Access to:
    - ProcurePath.  
    - Buyer-only tabs in Engagement Rooms.  
    - Shared tabs in Engagement Rooms.  
    - Buyer-mode and shared ValueSphere (where permitted).  
  - Can:
    - Create sourcing events and RFX (if allowed).  
    - Evaluate vendors, complete scorecards.  
    - Participate in procurement timelines and approvals.

- **Dual-Suite User**
  - Has both Vendor and Buyer Suite entitlements.  
  - Effective role depends on context:
    - In vendor-owned rooms and accounts → vendor behaviour.  
    - In buyer-owned contexts → buyer behaviour.  
  - Must never see cross-org private data except through explicit shared artefacts.

### 4.4 Guest Users

- **Guest**
  - External user invited to an Engagement Room.  
  - Only sees **shared tabs** (shared MAP, shared docs, shared architecture, shared ValueSphere, and shared RFX surfaces).  
  - Has no access to:
    - RevenueForge.  
    - ProcurePath.  
    - Vendor-only or buyer-only tabs.  
  - Experience includes prominent prompts to:
    - “Unlock Procurement Workspace” (if they appear buyer-side).  
    - “Unlock Vendor Intelligence Workspace” (if they appear seller-side).

---

## 5. High-Level Domain Model

> Full schema details live in `domain_model.md`.  
> This section defines the canonical entities and relationships.

### 5.1 Identity and Organisation

- **User**
  - Global identity; linked to external identity providers.  

- **UserProfile**
  - Name, avatar, job title, department, phone, timezone, notification preferences.

- **Organization**
  - Represents a tenant.  
  - Contains high-level metadata and configuration (name, domain, plan, limits).

- **OrganizationMembership**
  - Links User ↔ Organization.  
  - Holds suite entitlements and org-level roles (owner/admin/user).

### 5.2 Vendor-Side Entities

- **Account**
  - Vendor-side view of a customer organisation (often mapped to a CRM Account).  
  - Can link to underlying CRM records and one or more Engagement Rooms.

- **Stakeholder**
  - Individual people associated with an Account.  
  - Holds role, influence, sentiment, and relationship information.

- **InteractionLog**
  - Combined timeline of emails, meetings, calls (e.g. Gong), and notes.

- **Qualification**
  - Structured qualification data (MEDDIC/BANT/custom) attached to an Account or Room.

- **CompetitiveIntel**
  - Data about competitors relevant to an Account or opportunity.

### 5.3 Buyer-Side Entities

- **VendorRecord**
  - Buyer-side representation of a vendor.  
  - May link to one or more Engagement Rooms and RFX.

- **SourcingEvent**
  - Represents a procurement initiative or project.  
  - Links to VendorRecords, RFX, and Engagement Rooms.

### 5.4 Collaboration Entities

- **EngagementRoom**
  - Central collaboration object; links vendor-side Accounts and buyer-side VendorRecords / SourcingEvents.  
  - Holds configuration for vendor-only, shared, and buyer-only panels.

- **RoomParticipant**
  - Links User ↔ EngagementRoom with participant role (vendor_user, buyer_user, guest).

- **RoomMessage**
  - Messages posted in a room (chat, threads, comments).

- **RoomTask** (shared MAP items)
  - Tasks, owners, due dates, and status used in mutual action plans.

- **RoomDocument**
  - Document metadata and versions shared in a room.

- **RoomTimelineEvent**
  - High-level events within a room (milestones, decisions, escalations).

### 5.5 RFX Entities

- **Rfx**
  - Represents an RFX event (RFP/RFQ/RFI).  
  - Consists of sections and questions, and is attached to SourcingEvents and Engagement Rooms.

- **RfxSection**
  - Logical grouping of questions within an RFX.

- **RfxQuestion**
  - Individual question, with type (text, multi, numeric, attachment), weight, and evaluation rubric.

- **RfxResponse**
  - A vendor’s answer to a specific question.

- **RfxEvaluation**
  - Buyer’s scoring, comments, and AI-assisted evaluation per response or overall.

### 5.6 ValueSphere Entities

- **ValueModelTemplate**
  - Predefined questionnaire / model templates (seller and buyer variants).

- **ValueAssessment**
  - Instance of a ValueModelTemplate filled out for a specific Account, VendorRecord, or Engagement Room.

- **ValueScenario**
  - Specific scenario configurations (e.g. “Conservative”, “Expected”, “Aggressive”).

- **ValueResponse**
  - Stored responses and results, including numeric metrics and narrative findings.

### 5.7 Operability Entities

- **Notification**
  - Stores user-targeted notification events for UI and email channels.

- **AuditLog**
  - Immutable record of key actions and state transitions.

- **IntegrationConfig**
  - Stores configuration and credentials (securely) for external integrations.

- **IntegrationState**
  - Tracks sync status, last run, errors, and connection health.

---

## 6. Lifecycles and States

Each major entity has a defined lifecycle. All transitions that affect business processes must be written to `AuditLog`.

### 6.1 EngagementRoom.status

- `draft` → created but not fully active (e.g. pending participants).  
- `active` → collaboration in progress.  
- `closed` → collaboration completed but still visible for reference.  
- `archived` → cold storage; minimal UI presence.

### 6.2 Rfx.status

- `draft` → being authored by buyers.  
- `issued` → sent to vendors; published in corresponding Engagement Rooms.  
- `responding` → vendors are submitting responses.  
- `evaluation` → internal buyer evaluation in progress.  
- `shortlist` → vendors shortlisted.  
- `decision` → a decision is being finalised.  
- `closed` → completed and no longer active.

### 6.3 Task.status (RoomTask / MAP items)

- `open`  
- `in_progress`  
- `blocked`  
- `done`

### 6.4 ValueAssessment.state

- `draft` → being built by one side.  
- `shared` → shared into room; visible to the other side.  
- `agreed` → both sides have agreed on assumptions and structure.  
- `locked` → frozen for reference in decision or contract phases.

### 6.5 SourcingEvent.status

- `initiated`  
- `requirements_defined`  
- `rfx_draft`  
- `rfx_issued`  
- `responding`  
- `evaluation`  
- `shortlist`  
- `negotiation`  
- `decision`  
- `contract_signed`  
- `closed`

---

## 7. Product Behaviours

### 7.1 RevenueForge

**Purpose:**  
Primary workspace for vendor-side teams to manage accounts, intelligence, and collaboration.

Key behaviours:

- **Account 360**  
  - Consolidates CRM data, interactions, qualification, value assessments, and Engagement Room links.  

- **Stakeholder Mapping**  
  - Capture contacts, roles, influence, sentiment, and coverage gaps.  

- **Interaction Timeline**  
  - Unified feed of emails, meetings, Gong calls, notes, and key room events.  

- **Qualification & Discovery**  
  - Structured frameworks stored as Qualification entities; used heavily in vendor-only tabs.  

- **Competitive Analysis**  
  - Store and retrieve competitor context, previous wins/losses, and recommended strategies.  

- **Internal MAP**  
  - Vendor-only plan of actions and milestones, some of which can be **promoted to shared MAP** in Engagement Rooms.

- **Integration-Driven Intelligence**  
  - Integration signals (e.g., from Gong, Clari, product usage) feed into Account health scores and recommended actions.

### 7.2 ProcurePath

**Purpose:**  
Primary workspace for buyer-side teams to manage procurement, risk, and evaluations.

Key behaviours:

- **Vendor Records**  
  - Canonical place to manage vendor-level information across sourcing events.  

- **Sourcing Events**  
  - Coordinate multi-vendor evaluations, timelines, stakeholders, and approvals.  

- **RFX Management**  
  - Build RFX using structured model; issue to vendors via Engagement Rooms.  

- **Evaluation & Scorecards**  
  - Use RfxEvaluation and ValueSphere outputs to build structured, comparable views.  

- **Risk & Compliance**  
  - Track risk assessments, security/compliance reviews, legal status, and incidents.  

- **Approvals & Governance**  
  - Drive sign-offs across finance, legal, security, IT, and business stakeholders.

### 7.3 Engagement Rooms

**Purpose:**  
Neutral collaboration plane connecting vendor and buyer views without compromising internal boundaries.

Core behaviours:

- Link Vendor Accounts ↔ Buyer VendorRecords / SourcingEvents.  
- Provide **vendor-only**, **shared**, and **buyer-only** tab sets.  
- Allow AI-augmented collaboration (summaries, suggestions, etc.) without leaking restricted information.  
- Coordinate documents, timelines, RFX responses, and decisions across both sides.

### 7.4 ValueSphere

**Purpose:**  
Structured Q&A and modelling layer for value and risk.

Key behaviours:

- Template-driven questionnaires.  
- Support numeric inputs, scales, and free text.  
- Provide scenario modelling (e.g., best/expected/worst case).  
- Drive both seller narratives and buyer evaluation logic.  
- Generate summarised outputs suitable for executives and boards.

---

## 8. UI and Theming

> Details live in `ui_conventions.md`.

Agama uses a **liquid glass aesthetic** with three core theme axes:

- **Seller theme** (blue / purple liquid glass)  
  - RevenueForge.  
  - Vendor-only tabs.  
  - Vendor-focused modals and panels.

- **Buyer theme** (green liquid glass)  
  - ProcurePath.  
  - Buyer-only tabs.  
  - Buyer evaluation, RFX authoring, and risk views.

- **Shared theme** (orange liquid glass)  
  - Shared tabs in Engagement Rooms (docs, MAP, messages, shared architecture, shared ValueSphere, shared RFX surface).  

Implementation rule:

- Every UI component must conceptually be tagged with one of:
  - `seller`
  - `buyer`
  - `shared`
- Theme tokens then map to actual CSS/JS styling.

---

## 9. Dashboards

> Details live in `dashboard_overview.md`.

### 9.1 Vendor Dashboard

Shows:

- **My Accounts** – with health, recent activity, and risk flags.  
- **My Engagement Rooms** – where the user is a vendor participant.  
- **My Tasks** – from internal and shared MAPs.  
- **Integration Health** – status of CRM, Gong, Clari, email sync.  
- **AI Suggestions** – recommended next actions, stakeholders at risk, upcoming milestones.

### 9.2 Buyer Dashboard

Shows:

- **Active Sourcing Events** – status of RFX and evaluations.  
- **Vendor Evaluation Progress** – where scorecards are incomplete or blocked.  
- **Approvals Awaiting Action** – for the logged-in user.  
- **Vendor Risk Summaries** – risk levels, incidents, or compliance flags.  
- **AI Insights** – recommended vendors to review, outliers, and unexpected trends.

### 9.3 Guest Dashboard

Shows:

- **Rooms I’m In** – limited to shared context.  
- **Shared Tasks** – those assigned to or relevant for the guest.  
- **Key Shared Updates** – RFX questions or docs visible at shared level.  
- Upsell surfaces to:
  - Buyer Suite (for buyer-like guests).  
  - Vendor Suite (for vendor-like guests).

### 9.4 Dual-Suite Users

- Provide a **toggle** or tabbed UI between:
  - **Seller Workspace** – vendor dashboard.  
  - **Procurement Workspace** – buyer dashboard.

  ### 9.5 Dashboard Dependency Mapping

Each dashboard panel must declare its data dependencies and permission requirements.

Examples:

- Vendor “My Accounts” requires vendorSuite + orgId match.
- Buyer “Vendor Evaluation Progress” requires buyerSuite and active SourcingEvent participation.
- Guest “Rooms I’m In” requires RoomParticipant.role = guest.

Codex must not fetch data for any panel unless permissions for that panel are satisfied.


---

## 10. Notifications and Search

> Detailed behaviour in `notifications.md` and `search_architecture.md`.

### 10.1 Notifications

Initial focus: **in-app notifications** (bell icon, top-right). Email later.

Trigger categories:

- New room messages.  
- New or updated tasks / MAP items.  
- RFX events (issued, question added, response submitted, evaluation completed).  
- ValueSphere events (assessment shared, changed, agreed, locked).  
- Document events (uploaded, updated, commented).  
- Invitation / membership events.  
- Risk alerts from AI or integrations.  
- Integration failures or warning events.

Notification entity:

- `Notification { userId, orgId, type, title, body, entityType, entityId, read, createdAt }`

### 10.2 Search

- **Phase 1** – MongoDB text search and indexes:
  - Accounts, Rooms, Tasks, Documents, RFX, ValueSphere artefacts, Stakeholders.  

- **Phase 2** – Dedicated search service (OpenSearch/Elastic):
  - Indexes:
    - Structured entities (rooms, accounts, RFX, ValueSphere, etc.).  
    - Unstructured text (docs, call transcripts, emails).  
  - Adds:
    - Relevance scoring.  
    - Semantic search.  
    - Role-based filtering at query time.

---

## 11. Invitations and Profiles

> Detailed flows in `user_invitation.md` and `user_profile.md`.

### 11.1 Internal User Invitations

- Initiated by Org Owners/Admins.  
- Specify:
  - Email.  
  - Org roles.  
  - Suite entitlements (Vendor Suite, Buyer Suite).  
  - Super User flags if relevant.  
- Invitation object includes token, expiry, and initial role configuration.  
- Recipients authenticate via WorkOS and accept/complete onboarding.

### 11.2 Guest Invitations

- Initiated from Engagement Rooms.  
- Room-scoped and minimal:
  - `isGuest: true`  
  - `roomId`  
  - Limited permissions (shared only).  

Flow:

- Recipient uses **magic link**, not SSO.  
- Creates a lightweight profile.  
- Gains access only to shared tabs of the specific room.

### 11.3 Profiles

- UserProfile contains:
  - Name, avatar, title, department.  
  - Contact details (where allowed).  
  - Timezone.  
  - Notification preferences.  
- Profiles displayed:
  - In assignments (tasks, RFX questions, approvals).  
  - In room participant lists.  
  - In stakeholder mapping contexts.

---

## 12. Real-Time Collaboration and AI

### 12.1 Real-Time Collaboration

Core features:

- Real-time **messaging** in Engagement Rooms.  
- Real-time **MAP and task updates** (RoomTask).  
- Real-time **document changes** and comments (where feasible).  
- Real-time **architecture canvas** collaboration.  
- Presence indicators (who is in the room, who is typing, etc.).

Minimum viable architecture:

- WebSockets or SSE endpoints.  
- Room-based channels keyed on EngagementRoom IDs.  
- Conflict resolution rules:
  - Last-write-wins initially.  
  - Option for CRDT-based reconciliation later if needed.

### 12.2 AI Layer

AI must obey **strict context and permission boundaries**.

Allowed categories:

- **Vendor-only AI**:
  - Summarise vendor Accounts.  
  - Suggest qualification updates.  
  - Extract risks and opportunities from Gong/Clari/email.  
  - Draft vendor responses to RFX questions.  

- **Buyer-only AI**:
  - Summarise vendor responses.  
  - Suggest evaluation scores (soft suggestions).  
  - Highlight risk areas.  
  - Generate comparative summaries of vendors.  

- **Shared AI**:
  - Summarise room activity and decisions.  
  - Help articulate value narratives in ValueSphere.  
  - Draft mutual action plans.  

Hard rule:

> AI must **never** use `vendor_only` data when generating buyer-visible content, and must never use `buyer_only` data when generating vendor-visible content.

### 12.3 Cross-Suite AI Guardrails

AI operating in Engagement Rooms, RevenueForge, ProcurePath, or ValueSphere must obey:

- seller-only outputs use seller-only + shared data only
- buyer-only outputs use buyer-only + shared data only
- shared outputs must be generated solely from shared data

AI must never:
- Infer shortlist or scoring for vendors
- Infer competitive positioning from buyer-only fields
- Reveal seller-only assumptions in buyer-facing outputs
- Combine buyer-only and vendor-only datasets in any response
- Use private context to optimise or steer vendor-buyer negotiations

Codex must implement a context-sanitisation layer that enforces these constraints.


---

## 13. Integrations and Future Migration

> Technical details in `integrations.md` and `future_migration.md`.

### 13.1 Integrations

- **Vendor-side**:
  - CRM (Salesforce, HubSpot).  
  - Gong (calls and transcripts).  
  - Clari (forecast and risk).  
  - Email & Calendar (Google/Microsoft).  

- **Buyer-side**:
  - Procurement ERP.  
  - Contract management systems.  
  - Risk feeds (security, financial).

- **Universal**:
  - WorkOS for identity and SSO.

Each integration:

- Has a configuration object.  
- Operates via scheduled syncs and/or webhooks.  
- Writes structured events into core entities (InteractionLog, VendorRecord, etc.).  
- Surfaces errors and status via IntegrationState.

### 13.2 Hosting and Migration

- **Current**: Render + MongoDB Atlas.  
- **Future**: containerised deployment on AWS or GCP with:
  - Autoscaled application services.  
  - Background workers for integrations.  
  - Redis for caching and real-time features.  
  - SQS or equivalent for queues.  
  - Dedicated search cluster.  
  - VPC networking and private endpoints.  

Migration must be **transparent** to tenants and maintain all security and auditing guarantees.

---

## 14. Implementation Rules for Codex and Developers

1. **This document is the source of truth**. If any other doc conflicts, this wins.  
2. **Always enforce authorisation and visibility**:
   - Use explicit helper functions (e.g. `canViewRoom`, `canEditRfx`, `canSeeBuyerPanel`).  
3. **Keep Engagement Rooms focused** on collaboration and linking; avoid overloading them with business logic that belongs in RevenueForge or ProcurePath.  
4. **Respect suite boundaries and theming**:
   - Never show buyer-only panels to vendors or vice versa.  
5. **Use the domain model**:
   - Always store data in the correct canonical entity type.  
6. **Log important transitions**:
   - Lifecycle state changes go to AuditLog.  
7. **Design AI features to be overrideable and explainable**:
   - AI suggestions should never be the only way to complete a workflow.  
8. **Update this spec FIRST when evolving the platform**, then:
   - Update relevant sub-docs.  
   - Update code and tests.  

---

## 15. Active Organisation Context

Users belonging to multiple Organisations must explicitly select an active org context after authentication.
All suite entitlements, dashboard views, room visibility, search results, and notifications depend on the active org.

Switching org updates:
- Navigation structure
- Dashboard content
- Available Engagement Rooms
- Suite access (vendorSuite, buyerSuite)
- Permissions and context-sensitive UI

Org context switching must never reveal cross-org data during transition.


---

## 16. Licensing and Pricing

- Every real user belongs to an **Organisation**; licences are **business-only** and purchased at the org level.
- Licensing is **seat-based**. Seat assignments are tied to suites and are managed by org owners/admins.

Suites and seat types:

- **Vendor Suite** – paid seat for vendor-side users.
- **Buyer Suite** – paid seat for buyer-side users.
- **Both Suites** – paid seat that combines Vendor and Buyer suite entitlements.
- **Guest** – invited participant in Engagement Rooms with shared-tab access only; **no seat consumption**.

Seat limits (per organisation):

- `seatLimits.vendorSuite`
- `seatLimits.buyerSuite`
- `seatLimits.bothSuites`
- `seatLimits.totalSeats` governs combined usage; any requested increase above **200 total seats** triggers a **“Contact Sales”** flow.

Pricing (USD, monthly):

- Vendor Suite: **$150 / seat / month**
- Buyer Suite: **$190 / seat / month**
- Both Suites: **$250 / seat / month**
- Guests: **Free**

For full details, see `/docs/licensing_and_pricing.md`.


This MASTER SPEC defines the **complete conceptual blueprint** of the Agama platform.
All subsequent `.md` files (domain_model, roles_permissions, ui_conventions, etc.) elaborate specific slices of this model and must stay consistent with this document.