# Agama Platform Overview

## 1. What Agama Is

Agama is a dual-sided enterprise platform for:

- **Vendors** (GTM, sales, value consulting, customer success)
- **Buyers** (procurement, finance, legal, security)

It unifies three primary applications:

- **RevenueForge** — AI GTM & deal execution suite (vendor side)
- **ValueSphere** — value consulting & strategic assessments (vendor side)
- **ProcurePath** — vendor, deal, and contract intelligence (buyer side)

The unique glue is the **Engagement Room**: a shared, secure space where vendors and buyers collaborate on the same initiatives, projects, and contracts, powered by AI.

---

## 2. Suites

### Vendor Suite

Accessible to organisations with `orgType = 'vendor'` or `'both'` and appropriate license:

- **RevenueForge**
  - Deal and account workspaces
  - Meeting notes and AI summaries
  - Deal intelligence and strategy copilots
- **ValueSphere**
  - Navigator assessments
  - Value stories and business cases
  - Advisory and roadmap outputs

### Buyer Suite

Accessible to organisations with `orgType = 'buyer'` or `'both'`:

- **ProcurePath**
  - Vendor relationship graphs
  - Contract lifecycle management and strategy
  - Risk, compliance, and renewal intelligence

---

## 3. Engagement Rooms

### 3.1 Purpose

An **Engagement Room** is a shared workspace between:

- a **Vendor organisation** and
- a **Buyer organisation**

for a specific **account, vendor relationship, initiative, or project**.

Rooms provide:

- A **single source of truth** for communication and decisions
- Transparency across the lifecycle:
  - Pre-sale discovery and PoC
  - Sales handover and implementation
  - Adoption and ongoing operations
  - Expansion and renewals

### 3.2 Capabilities

Each Engagement Room includes:

1. **Communication**
   - Message feed with thread-style conversations
   - Mentions and basic formatting
   - AI-generated summaries and status digests

2. **Project Management Table (Issue Board)**
   - Dynamic table similar to Monday-style boards
   - Each row is an **Issue** with fields:
     - Title
     - Description
     - Status (`not_started`, `in_progress`, `completed`, `stuck`)
     - Assignees (one or more users, full or guest)
     - Due date
     - Notes
   - Used for:
     - Implementation tasks
     - Risk / blockers
     - Change requests
     - Ongoing operational work

3. **Document Collaboration**
   - Room-specific document library
   - File metadata and version history
   - Comments and discussion per document
   - AI validation/analysis of documents (e.g. contracts, SoWs, project plans)

4. **Deliverables & Milestones**
   - Track key deliverables and milestones:
     - Name
     - Description
     - Due date
     - Owner(s)
     - Status
   - Linked to:
     - Issues
     - Documents
   - Used to power AI status reports and renewal readiness checks

5. **Membership, Invites, and Guest Collaboration**
   - Room-scoped membership (see below)
   - Internal user search within an organisation
   - Email-based invitations for external collaborators (guests)
   - AI-assisted summaries and reporting for stakeholders

---

## 4. User Types, Organisations, and Access

### 4.1 Organisations

Each `Organization` has:

- `orgType: 'vendor' | 'buyer' | 'both'`
- Licensed products (e.g. `['revenueforge', 'valuesphere', 'procurepath']`)
- Members via `OrganizationMembership`

### 4.2 User Types

Each `User` has:

- WorkOS identity (`workosUserId`, `email`, etc.)
- A `licenseTier`:
  - `full` — full licensed user, can access all licensed suites and org-level entities according to their role
  - `guest` — tightly scoped collaborator, limited to specific Engagement Rooms

**WorkOS** is the source of truth for identity and email delivery. The application:

- Stores WorkOS user/organisation mapping
- Uses WorkOS tokens and sessions for auth
- Does not implement its own email sending or password flows

### 4.3 Membership & Permissions

**Organisation membership** (via `OrganizationMembership`):

- Defines high-level roles like `owner`, `admin`, `member`, `viewer`
- Controls access to suites (Vendor/Buyer) and configuration

**Engagement Room membership** (via `EngagementRoomMembership`):

- Defines room-specific roles:
  - `room_admin` — can manage the room, invites, settings
  - `editor` — can create/update issues, upload documents, comment
  - `viewer` — read-only access to room content
- Every member is associated with exactly one `Organization` in the context of the room (vendor or buyer side)

**Guest users**:

- Always have `licenseTier = 'guest'`
- Can only see:
  - Rooms they are members of
  - Content within those rooms
- Cannot:
  - Browse full org user directory
  - Access billing or configuration
  - Access arbitrary other entities without being in a room

---

## 5. Lifecycle Coverage

Engagement Rooms are used across the lifecycle:

- **Pre-Sale**
  - Capture discovery notes, Navigator outputs
  - Track PoC tasks and issues
  - Share draft proposals and validate them with AI

- **Sales Handover**
  - Handover from sales to implementation/CS with a single history
  - Project plan and milestones set in the issue board

- **Onboarding & Adoption**
  - Implementation tasks tracked in the project board
  - Documented runbooks, designs, and approvals stored and commented
  - AI generates periodic status reports

- **Ongoing Relationship**
  - Operational issues and improvements tracked as issues
  - Quarterly milestones and value realisation tracked for renewals
  - Shared governance documentation and decisions stored in the room

- **Renewal & Expansion**
  - Renewal plan and negotiation strategy for both vendor and buyer
  - AI views help both sides understand value delivered and risk
  - Actions to reduce risk and improve outcomes captured in the project board

Agama’s AI layer uses the Engagement Room as the context hub to generate insightful, role-specific guidance for both vendors and buyers.
