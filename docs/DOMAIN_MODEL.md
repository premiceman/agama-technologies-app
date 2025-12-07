# domain_model.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Domain Model Specification  
Last Updated: (update when committed)

This document defines the **complete Agama domain model**, including:

- Entities (what objects exist in the system)  
- Fields (what data we store on each)  
- Relationships between entities  
- Lifecycle states (status/state enums and transitions)  
- Visibility and tenancy rules  

It is the canonical reference for:

- Database schemas and migrations  
- Backend services and controllers  
- Codex prompts that need to reason about or modify data  
- Frontend models and TypeScript interfaces  

If this document conflicts with any other, **`MASTER_SPEC.md` wins**, but all other docs (e.g. `platform_overview.md`, `engagement_rooms.md`, `revenueforge.md`, `procurepath.md`, `rfx_framework.md`, `valuesphere.md`) MUST be kept consistent with this domain model.

---

## 1. High-Level Structure

Agama’s domain model can be grouped into seven major areas:

1. **Identity & Organisation**  
2. **Vendor-Side Entities (RevenueForge)**  
3. **Buyer-Side Entities (ProcurePath)**  
4. **Engagement Rooms (Collaboration Layer)**  
5. **RFX / RFP / RFQ Entities**  
6. **ValueSphere Entities**  
7. **Operability & Infrastructure Entities**  

Every tenant-scoped entity must carry an `orgId` or equivalent, and queries must always be scoped appropriately.

---

## 2. Identity & Organisation

These entities control who the user is, what org they belong to, and what suites/roles they have.

### 2.1 User

**Purpose:** Global identity for a human being using Agama.

**Key points:**

- A `User` may belong to multiple Organisations through `OrganizationMembership`.  
- A `User` may participate in multiple `EngagementRoom`s via `RoomParticipant`.  
- A `User` may act as a Guest in another org’s Room.

**Fields:**

- `_id: ObjectId`
- `primaryEmail: string`  
- `authProviderId: string` (WorkOS user ID / SSO ID)  
- `status: 'active' | 'suspended'`  
- `createdAt: Date`  
- `lastLoginAt: Date | null`  
- `globalPreferences: {  
    language?: string;  
    timezone?: string;  
    darkMode?: boolean;  
  }`

**Relationships:**

- `User` 1 — *N* `OrganizationMembership`  
- `User` 1 — *1* `UserProfile`  
- `User` 1 — *N* `RoomParticipant`  
- `User` 1 — *N* `Notification`  
- `User` 1 — *N* `AuditLog` (as `actorUserId`)

---

### 2.2 UserProfile

**Purpose:** Display and preference layer for a User.

**Fields:**

- `_id: ObjectId`
- `userId: ObjectId` (FK → User)  
- `name: string`  
- `title?: string`  
- `department?: string`  
- `avatarUrl?: string`  
- `phoneNumber?: string`  
- `timezone?: string`  
- `notificationPreferences: {  
    inApp: boolean;  
    email: boolean;  
  }`

**Usage:**

- Shown in Room participants, task assignees, approvals lists, comments, etc.  
- Used by Notification routing.

---

### 2.3 Organization

**Purpose:** Represents a tenant (a company using Agama).

**Fields:**

- `_id: ObjectId`
- `name: string`  
- `domain?: string` (primary email domain)  
- `createdAt: Date`  
- `plan: 'free' | 'vendorSuite' | 'buyerSuite' | 'dualSuite'`  
- `billingInfo?: {  
    billingEmail: string;  
    billingProviderId?: string;  
  }`
- `settings: {  
    themeBranding?: any;       // future brand overrides  
    dataResidency?: string;    // region constraints later  
    features?: string[];  
  }`

**Relationships:**

- `Organization` 1 — *N* `OrganizationMembership`  
- `Organization` 1 — *N* `AgamaAccount` (vendor side view)  
- `Organization` 1 — *N* `VendorRecord` (buyer side view)  
- `Organization` 1 — *N* `SourcingEvent`  
- `Organization` 1 — *N* `EngagementRoom` (where it is the vendor org)  
- `Organization` 1 — *N* `Notification`, `AuditLog`, `IntegrationConfig`, etc.

---

### 2.4 OrganizationMembership

**Purpose:** Relationship between a User and an Organization, including roles and suite entitlements.

**Fields:**

- `_id: ObjectId`
- `userId: ObjectId` (FK → User)  
- `orgId: ObjectId` (FK → Organization)  
- `role: 'org_owner' | 'org_admin' | 'user'`  
- `entitlements: {  
    vendorSuite: boolean;  
    buyerSuite: boolean;  
  }`
- `superUser: {  
    vendor: boolean;  
    buyer: boolean;  
  }`
- `status: 'active' | 'pending_invite' | 'suspended'`  
- `createdAt: Date`  
- `invitedAt?: Date`  
- `acceptedAt?: Date`

**Constraints:**

- Each org must have **at least one** `org_owner`.  
- `org_owner` implies `entitlements` coverage as needed but does *not* automatically grant buyer/vendor suite to all users.

---

### 2.5 Invite

**Purpose:** Represent invitations sent to internal users or guests.

**Fields:**

- `_id: ObjectId`
- `email: string`
- `orgId?: ObjectId` (required for internal invites)  
- `roomId?: ObjectId` (for room-specific guest invites)  
- `isGuest: boolean`  
- `roleAssignments?: {  
    vendorSuite?: boolean;  
    buyerSuite?: boolean;  
    orgRole?: 'org_owner' | 'org_admin' | 'user';  
    superUser?: { vendor?: boolean; buyer?: boolean };  
  }`
- `invitedByUserId: ObjectId`  
- `token: string`  
- `status: 'pending' | 'accepted' | 'expired' | 'revoked'`  
- `expiresAt: Date`  
- `createdAt: Date`  
- `acceptedAt?: Date`

**High-level behaviour:**

- Internal user invite: `orgId` present, `isGuest = false`.  
- Guest invite: `roomId` present, `isGuest = true`.  
- Second step (after WorkOS auth for internal, or direct for guest) creates `OrganizationMembership` (internal) or `RoomParticipant` (guest).

---

## 3. Vendor-Side Entities (RevenueForge)

Vendor-side entities live **inside a vendor organisation** and are represented primarily through `AgamaAccount` and associated objects.

### 3.1 AgamaAccount

**Purpose:** The **unified account object**. Represents any business entity the org interacts with: customer, vendor, or partner. Vendor orgs mostly use `type = 'customer'`; buyer orgs often use `type = 'vendor'`.:contentReference[oaicite:1]{index=1}  

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId` (the org that “owns” this view of the account)  
- `type: 'customer' | 'vendor' | 'partner'`  
- `name: string`  
- `domain?: string`  
- `industry?: string`  
- `region?: string`  
- `size?: 'small' | 'mid' | 'enterprise' | 'unknown'`  
- `metadata?: any` (safe, key-value metadata)  
- `linkedCrmAccounts: {  
    provider: 'salesforce' | 'hubspot' | 'other';  
    crmId: string;  
    syncState: 'pending' | 'ok' | 'error';  
  }[]`
- `linkedComms: {  
    provider: 'gong' | 'clari' | 'email' | 'calendar' | 'other';  
    externalId: string;  
  }[]`
- `teamMemberIds: ObjectId[]` (users in this org attached to this account)  
- `healthScore?: number` (0–100 or similar)  
- `tags?: string[]`  
- `createdAt: Date`  
- `updatedAt: Date`

**Relationships:**

- `AgamaAccount` 1 — *N* `Stakeholder`  
- `AgamaAccount` 1 — *N* `InteractionLog`  
- `AgamaAccount` 1 — *N* `Qualification`  
- `AgamaAccount` 1 — *N* `ArchitectureDesign`  
- `AgamaAccount` 1 — *N* `ValueAssessment` (seller-mode)  
- `AgamaAccount` 1 — *N* `EngagementRoom` (as vendorAccountId or buyerAccountId depending on perspective)

---

### 3.2 Stakeholder

**Purpose:** Represent a known person associated with an AgamaAccount (customer or vendor).

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `agamaAccountId: ObjectId`  
- `name: string`  
- `jobTitle?: string`  
- `department?: string`  
- `email?: string`  
- `phone?: string`  
- `roleInDeal?: 'economic_buyer' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'other'`  
- `influence: 'high' | 'medium' | 'low' | 'unknown'`  
- `sentiment: 'positive' | 'neutral' | 'negative' | 'unknown'`  
- `relationshipStrength?: number` (0–100)  
- `notes?: string`  
- `tags?: string[]`  
- `lastInteractionAt?: Date`  
- `createdAt: Date`  
- `updatedAt: Date`

---

### 3.3 InteractionLog

**Purpose:** Single unified event log for all interactions (email, calls, meetings, notes, system events) related to an AgamaAccount and optionally to an EngagementRoom.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `agamaAccountId: ObjectId`  
- `roomId?: ObjectId` (if the interaction happened inside or is associated to a Room)  
- `type: 'email' | 'meeting' | 'call' | 'note' | 'integration_signal' | 'system_event'`  
- `source: 'crm' | 'gong' | 'clari' | 'email' | 'calendar' | 'manual' | 'system'`  
- `timestamp: Date`  
- `subject?: string`  
- `summary?: string` (short summary, may be AI-generated)  
- `bodyPreview?: string`  
- `metadata?: any` (e.g. Gong transcript references, Clari risk flags)  
- `createdByUserId?: ObjectId` (for manual or note-type events)  
- `createdAt: Date`

---

### 3.4 Qualification

**Purpose:** Structured representation of seller qualification (MEDDIC, BANT, custom frameworks).

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `agamaAccountId: ObjectId`  
- `roomId?: ObjectId` (if qualification is specific to a Room/opportunity)  
- `framework: 'MEDDIC' | 'BANT' | 'CUSTOM'`  
- `fields: {  
    key: string;           // e.g. 'metrics', 'economic_buyer'  
    label: string;  
    value?: string;  
    confidence?: 'low' | 'medium' | 'high';  
  }[]`
- `ownerUserId: ObjectId`  
- `visibility: 'vendor_only' | 'shared'`  
- `createdAt: Date`  
- `updatedAt: Date`

**Visibility:**

- `vendor_only` → appears only in RevenueForge and vendor tabs.  
- `shared` → a subset can be surfaced in shared tabs (or derived shared fields) in the Room.

---

### 3.5 CompetitiveIntel

**Purpose:** Deal-specific or account-wide competitive context.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `agamaAccountId: ObjectId`  
- `roomId?: ObjectId`  
- `competitorName: string`  
- `strengths?: string[]`  
- `weaknesses?: string[]`  
- `positioningNotes?: string`  
- `winLossSignals?: string`  
- `updatedAt: Date`  
- `createdByUserId: ObjectId`

---

### 3.6 ArchitectureDesign

**Purpose:** Represent a solution/architecture design for a given account or room, along with versioning and visibility. Used in both vendor-only and shared contexts.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `agamaAccountId: ObjectId`  
- `roomId?: ObjectId`  
- `version: number`  
- `diagramJson: any` (serialized diagram model)  
- `assumptions?: string[]`  
- `dependencies?: string[]`  
- `visibility: 'vendor_only' | 'shared'`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`

**Behaviour:**

- Vendor can maintain multiple drafts (`vendor_only`).  
- “Publish to shared” duplicates or flags one version as `visibility = 'shared'`, then surfaces it in the Room’s Shared Architecture panel.

---

## 4. Buyer-Side Entities (ProcurePath)

### 4.1 VendorRecord

**Purpose:** Buyer-side canonical record for each vendor they work with or evaluate. It pairs conceptually with `AgamaAccount` but is owned by the buyer org.:contentReference[oaicite:2]{index=2}  

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId` (buyer org)  
- `name: string`  
- `domain?: string`  
- `domainCategory: string` (e.g. 'observability', 'CRM', 'HRIS')  
- `linkedAgamaAccountId?: ObjectId` (optional reference to vendor-side AgamaAccount)  
- `riskProfileSummary?: string`  
- `tags?: string[]`  
- `createdAt: Date`  
- `updatedAt: Date`

---

### 4.2 SourcingEvent

**Purpose:** Represents a discrete sourcing initiative (e.g., “Select an Observability Platform for EMEA”).

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId` (buyer org)  
- `name: string`  
- `description?: string`  
- `budget?: number`  
- `currency?: string`  
- `scope?: string`  
- `timeline?: {  
    startDate?: Date;  
    decisionTargetDate?: Date;  
  }`
- `vendorRecordIds: ObjectId[]` (shortlist)  
- `rfxId?: ObjectId` (structured RFX for this event)  
- `status:  
    'initiated'  
  | 'requirements_defined'  
  | 'rfx_draft'  
  | 'rfx_issued'  
  | 'responding'  
  | 'evaluation'  
  | 'shortlist'  
  | 'negotiation'  
  | 'decision'  
  | 'contract_signed'  
  | 'closed'`
- `approvalChainId?: ObjectId`  
- `ownerUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`

---

### 4.3 BuyerRiskProfile

**Purpose:** Persistent record of risk views for a given VendorRecord.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `vendorRecordId: ObjectId`  
- `securityFindings?: string[]`  
- `complianceStatus?: 'unknown' | 'in_review' | 'passed' | 'failed'`  
- `financialStability?: 'unknown' | 'good' | 'concern' | 'critical'`  
- `regulatoryRisks?: string[]`  
- `incidentFlags?: string[]`  
- `externalNewsRefs?: string[]` (links/ids into news/risk feeds)  
- `updatedAt: Date`  

---

### 4.4 ApprovalChain & ApprovalStep

(Conceptual – details may live in `procurepath.md`.)

**ApprovalChain Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `sourcingEventId: ObjectId`  
- `steps: ObjectId[]` (ApprovalStep IDs, ordered)  
- `createdAt: Date`

**ApprovalStep Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `chainId: ObjectId`  
- `order: number`  
- `roleOrUserId: string | ObjectId` (could target a specific user or role group)  
- `status: 'pending' | 'approved' | 'rejected'`  
- `decisionAt?: Date`  
- `decisionByUserId?: ObjectId`  
- `comment?: string`

---

## 5. Engagement Rooms (Collaboration Layer)

Engagement Rooms are central to Agama’s collaboration design. Domain-wise, we treat them as cross-org collaboration objects with strict per-role visibility.

### 5.1 EngagementRoom

**Purpose:** A structured collaboration space linking a vendor account to a buyer’s context (sourcing event + vendor record), with vendor-only, shared, and buyer-only surfaces.

**Fields:**

- `_id: ObjectId`
- `vendorOrgId: ObjectId` (always required)  
- `buyerOrgId?: ObjectId` (present when buyer has a full org)  
- `vendorAccountId: ObjectId` (AgamaAccount from vendor org)  
- `buyerVendorRecordId?: ObjectId` (VendorRecord from buyer org)  
- `sourcingEventId?: ObjectId` (from buyer org)  
- `status: 'draft' | 'active' | 'closed' | 'archived'`  
- `roomName?: string`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`  

**Important invariants:**

- `vendorOrgId` always points to the vendor’s Organisation.  
- `buyerOrgId` may be null when working with only guest buyers (no Buyer Suite yet).  
- Room participants are defined in `RoomParticipant`.

---

### 5.2 RoomParticipant

**Purpose:** Link between a User and a Room with a specific role.

**Fields:**

- `_id: ObjectId`
- `roomId: ObjectId`
- `userId: ObjectId`  
- `role: 'vendor_user' | 'buyer_user' | 'guest'`  
- `joinedAt: Date`  
- `invitedByUserId?: ObjectId`

**Access rules:**

- `vendor_user`:  
  - Vendor-only panels + shared panels.  

- `buyer_user`:  
  - Buyer-only panels + shared panels.  

- `guest`:  
  - Shared panels only.  
  - Locked/greyed vendor/buyer tabs; upsell surfaces.

---

### 5.3 RoomMessage

**Purpose:** Messages in an Engagement Room’s conversation layer.

**Fields:**

- `_id: ObjectId`
- `roomId: ObjectId`
- `orgId: ObjectId` (originating org of the sender)  
- `senderUserId: ObjectId`  
- `content: string` (markdown or rich-text)  
- `threadId?: ObjectId` (null for root messages)  
- `parentMessageId?: ObjectId`  
- `attachments?: {  
    fileUrl: string;  
    fileName: string;  
    fileType?: string;  
  }[]`
- `mentions?: ObjectId[]` (User IDs)  
- `createdAt: Date`  
- `editedAt?: Date`

---

### 5.4 RoomTask (Shared MAP Item)

**Purpose:** Work item visible to both sides in the shared MAP board.

**Fields:**

- `_id: ObjectId`
- `roomId: ObjectId`
- `title: string`  
- `description?: string`  
- `ownerOrg: 'vendor' | 'buyer' | 'both'`  
- `assigneeUserId?: ObjectId`  
- `dueDate?: Date`  
- `status: 'open' | 'in_progress' | 'blocked' | 'done'`  
- `priority?: 'low' | 'medium' | 'high'`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`

_Note: vendor-only and buyer-only internal tasks live in their respective suite-side models, not here._

---

### 5.5 RoomDocument & RoomDocumentVersion

**RoomDocument Fields:**

- `_id: ObjectId`
- `roomId: ObjectId`
- `folder: 'business' | 'technical' | 'legal' | 'commercial' | 'security' | 'other'`  
- `name: string`  
- `publisherSide: 'vendor' | 'buyer'`  
- `visibility: 'shared'` (Room docs are always shared by definition; internal docs live elsewhere)  
- `currentVersionId: ObjectId`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`

**RoomDocumentVersion Fields:**

- `_id: ObjectId`
- `roomDocumentId: ObjectId`
- `versionNumber: number`  
- `fileUrl: string`  
- `checksum?: string`  
- `changeSummary?: string`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`

---

### 5.6 RoomTimelineEvent

**Purpose:** High-level timeline events in a Room (milestones, decisions, escalations, etc.).

**Fields:**

- `_id: ObjectId`
- `roomId: ObjectId`
- `orgId: ObjectId` (org that recorded the event)  
- `eventType: string` (e.g. 'milestone', 'decision', 'risk', 'info')  
- `visibility: 'shared' | 'vendor_only' | 'buyer_only'`  
- `title: string`  
- `description?: string`  
- `timestamp: Date`  
- `actorUserId?: ObjectId`  
- `createdAt: Date`

---

## 6. RFX Entities

RFX is first-class: it is structured, AI-ready, and drives vendor evaluation.

### 6.1 Rfx

**Purpose:** Root object representing an RFP/RFQ/RFI instance.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId` (buyer org)  
- `sourcingEventId: ObjectId`  
- `topicArea: string` (e.g. 'Observability Platform', 'Customer 360')  
- `overallWeight?: number`  
- `status: 'draft' | 'issued' | 'responding' | 'evaluation' | 'shortlist' | 'decision' | 'closed'`  
- `issuedAt?: Date`  
- `closeResponsesAt?: Date`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`

---

### 6.2 RfxSection

**Purpose:** Group questions into logical sections (security, architecture, pricing, etc.).:contentReference[oaicite:3]{index=3}  

**Fields:**

- `_id: ObjectId`
- `rfxId: ObjectId`
- `title: string`  
- `description?: string`  
- `weight?: number`  
- `order: number`  

---

### 6.3 RfxQuestion

**Purpose:** Individual question object within a section.

**Fields:**

- `_id: ObjectId`
- `rfxId: ObjectId`
- `sectionId: ObjectId`
- `prompt: string`  
- `type: 'text' | 'multi' | 'numeric' | 'attachment'`  
- `options?: string[]` (for 'multi' type)  
- `weight?: number`  
- `evaluationRubric?: string`  
- `tags?: string[]` (e.g. 'security', 'legal', 'performance', 'integration')  
- `required: boolean`  
- `order: number`  

---

### 6.4 RfxResponse

**Purpose:** A vendor’s response to a single RfxQuestion in a given Room.

**Fields:**

- `_id: ObjectId`
- `roomId: ObjectId` (vendor-specific Room for this buyer)  
- `rfxId: ObjectId`  
- `questionId: ObjectId`  
- `vendorOrgId: ObjectId`  
- `buyerOrgId?: ObjectId`  
- `answerText?: string`  
- `answerNumeric?: number`  
- `answerOptions?: string[]` (selected options for 'multi')  
- `attachments?: {  
    fileUrl: string;  
    fileName: string;  
  }[]`
- `submittedByUserId: ObjectId`  
- `submittedAt: Date`  
- `autoScore?: number`  // AI suggestion  
- `reviewScore?: number` // buyer manual score  
- `buyerComments?: {  
    reviewerUserId: ObjectId;  
    comment: string;  
    createdAt: Date;  
  }[]`

**Constraints:**

- Only users with **Vendor Suite** on vendor side can submit.  
- Only buyer users with appropriate rights can read scores/comments.

---

### 6.5 RfxEvaluation

**Purpose:** Aggregate evaluation per vendor per RFX.

**Fields:**

- `_id: ObjectId`
- `rfxId: ObjectId`
- `vendorRecordId: ObjectId`  
- `orgId: ObjectId` (buyer org)  
- `scoresBySection: { sectionId: ObjectId; score: number; weight?: number }[]`  
- `overallScore?: number`  
- `riskFlags?: string[]`  
- `recommendation?: string`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt?: Date`

---

## 7. ValueSphere Entities

ValueSphere must operate in seller-mode, buyer-mode, and shared-mode, but the core storage is unified.

### 7.1 ValueModelTemplate

**Purpose:** Template definition for structured value/risk questionnaires.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `mode: 'seller' | 'buyer' | 'shared'`  
- `name: string`  
- `description?: string`  
- `sections: {  
    sectionId: string;  
    title: string;  
    description?: string;  
    weight?: number;  
    questions: {  
      questionId: string;  
      label: string;  
      helpText?: string;  
      type: 'text' | 'numeric' | 'select' | 'multi' | 'boolean';  
      options?: string[];  
      weight?: number;  
      isKeyDriver?: boolean;  
    }[];  
  }[]`
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`

---

### 7.2 ValueAssessment

**Purpose:** Instance of a ValueModelTemplate applied to a given account/vendor/room.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId` (the org that owns this assessment)  
- `templateId: ObjectId`  
- `mode: 'seller' | 'buyer' | 'shared'`  
- `roomId?: ObjectId`  
- `agamaAccountId?: ObjectId` (seller perspective)  
- `vendorRecordId?: ObjectId` (buyer perspective)  
- `state: 'draft' | 'shared' | 'agreed' | 'locked'`  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt: Date`

- `responses: {  
    sectionId: string;  
    questionId: string;  
    responderUserId?: ObjectId;  
    valueText?: string;  
    valueNumeric?: number;  
    valueSelect?: string;  
    valueMulti?: string[];  
    lastUpdatedAt?: Date;  
  }[]`

- `summary?: {  
    narrative?: string;             // AI or human written  
    keyMetrics?: { name: string; value: number | string; unit?: string }[];  
    overallRecommendation?: string;  
  }`

---

### 7.3 ValueScenario

**Purpose:** Scenario modelling for an Assessment (e.g. Base, Conservative, Aggressive).

**Fields:**

- `_id: ObjectId`
- `assessmentId: ObjectId`
- `name: string`  
- `description?: string`  
- `inputsJson: any` (structured scenario inputs)  
- `resultsJson: any` (derived outputs)  
- `createdByUserId: ObjectId`  
- `createdAt: Date`  
- `updatedAt?: Date`

---

## 8. Operability & Infrastructure Entities

These are cross-cutting concerns that support governance, observability, search, notifications, and integrations.

### 8.1 Notification

**Purpose:** Per-user event notifications (in-app and optionally email).

**Fields:**

- `_id: ObjectId`
- `userId: ObjectId`
- `orgId: ObjectId`  
- `type: string` (e.g. 'room_message', 'task_assigned', 'rfx_updated', 'valuesphere_shared', 'invite_received', 'risk_alert')  
- `title: string`  
- `body: string`  
- `entityType?: string` (e.g. 'EngagementRoom', 'RoomTask', 'Rfx', 'ValueAssessment')  
- `entityId?: ObjectId`  
- `read: boolean`  
- `createdAt: Date`  
- `readAt?: Date`

---

### 8.2 AuditLog

**Purpose:** Immutable record of important actions and lifecycle transitions for compliance and debugging.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `actorUserId?: ObjectId`  
- `actorType: 'user' | 'system'`  
- `entityType: string`  
- `entityId: ObjectId`  
- `action: string` (e.g. 'create', 'update', 'delete', 'status_change', 'share_value_assessment', 'submit_rfx_response')  
- `before?: any` (snapshot or partial)  
- `after?: any`  
- `metadata?: any`  
- `createdAt: Date`

**Important:**  
- For large fields (e.g. document contents) we log only metadata or diffs, not entire blobs.  
- RFX scoring, ValueSphere state changes, and Room status transitions MUST be logged.

---

### 8.3 IntegrationConfig

**Purpose:** Store per-org integration configuration (CRM, Gong, etc).

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `type: 'crm' | 'gong' | 'clari' | 'email' | 'calendar' | 'procurement_erp' | 'other'`  
- `provider: string`  
- `config: any` (connection details – with secrets stored in a secure vault where possible)  
- `status: 'not_configured' | 'configured' | 'error'`  
- `lastErrorMessage?: string`  
- `createdAt: Date`  
- `updatedAt: Date`

---

### 8.4 IntegrationState

**Purpose:** Runtime/sync state for integrations.

**Fields:**

- `_id: ObjectId`
- `orgId: ObjectId`
- `integrationConfigId: ObjectId`  
- `lastSyncAt?: Date`  
- `nextSyncAt?: Date`  
- `lastSyncStatus?: 'ok' | 'error' | 'partial'`  
- `lastSyncSummary?: string`  
- `errorCount?: number`

---

### 8.5 SearchIndexItem (Logical Model)

Implementation may be in Elastic/OpenSearch; domain-wise we treat it as:

**Fields:**

- `id: string` (search index id)  
- `orgId: ObjectId`  
- `entityType: string` (Account, Room, Rfx, Document, ValueAssessment, Stakeholder, SourcingEvent, etc.)  
- `entityId: ObjectId`  
- `title?: string`  
- `bodyText?: string`  
- `tags?: string[]`  
- `createdAt: Date`  
- `updatedAt: Date`

---

## 9. Lifecycle & State Summary

For convenience, here are key state machines defined in this domain model:

- **EngagementRoom.status**  
  - `draft` → `active` → `closed` → `archived`.

- **Rfx.status**  
  - `draft` → `issued` → `responding` → `evaluation` → `shortlist` → `decision` → `closed`.

- **RoomTask.status**  
  - `open` → `in_progress` → (`blocked` ↔ `in_progress`) → `done`.

- **ValueAssessment.state**  
  - `draft` → `shared` → `agreed` → `locked`.

- **SourcingEvent.status**  
  - `initiated` → `requirements_defined` → `rfx_draft` → `rfx_issued` → `responding` → `evaluation` → `shortlist` → `negotiation` → `decision` → `contract_signed` → `closed`.

- **OrganizationMembership.status**  
  - `pending_invite` → `active` → `suspended`.

All state transitions that materially affect behaviour MUST be logged in `AuditLog`.

---

## 10. Implementation Notes for Codex and Engineers

1. **Always include `orgId`** on tenant-scoped entities and enforce it in queries and access checks.  
2. **Do not shortcut** by leaking vendor-only or buyer-only context into shared objects; visibility is encoded via:
   - `visibility` fields (e.g. in `Qualification`, `ArchitectureDesign`, `RoomTimelineEvent`).  
   - Room participant roles (`RoomParticipant.role`).  

3. **Use this domain model as the single source of truth** when:
   - Defining Mongoose/Prisma schemas.  
   - Creating migrations.  
   - Generating TypeScript interfaces.  

4. When extending the model:
   - Update this `domain_model.md` and `MASTER_SPEC.md` **first**.  
   - Then update downstream docs and implementations.

---

## 11. Invite

Fields:
- id
- email
- orgId (optional for internal invites)
- roomId (optional for guest invites)
- isGuest (boolean)
- roleAssignments:
  - orgRole
  - vendorSuite
  - buyerSuite
  - superUser:
    - vendor
    - buyer
- invitedByUserId
- token
- status (pending, accepted, expired, revoked)
- expiresAt
- createdAt
- acceptedAt (optional)

Rules:
- Internal invites must include orgId.
- Guest invites must include roomId and set isGuest = true.
- Tokens must be single-use and time-limited.


**End of domain_model.md**
