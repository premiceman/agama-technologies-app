# Domain Model

This document describes the core domain objects for the Agama platform, with a focus on Engagement Rooms, project management, and guest collaboration.

> NOTE: Field types and optionality are conceptual. The actual Mongoose schemas should follow these structures.

---

## 1. Core Entities

### 1.1 User

Represents a human user, backed by WorkOS for identity.

Fields (key ones):

- `_id: ObjectId`
- `workosUserId: string` — WorkOS user identifier
- `email: string`
- `name: string`
- `licenseTier: 'full' | 'guest'`
- `status: 'active' | 'disabled'`
- `createdAt: Date`
- `updatedAt: Date`

Notes:

- Auth and email flows are handled by WorkOS.
- `licenseTier = 'guest'` implies restricted access (see below).

---

### 1.2 Organization

Represents a company or tenant.

Key fields:

- `_id: ObjectId`
- `name: string`
- `orgType: 'vendor' | 'buyer' | 'both'`
- `productAccess: string[]` — e.g. `['revenueforge', 'valuesphere', 'procurepath']`
- `workosOrgId: string` (if applicable)
- `createdAt: Date`
- `updatedAt: Date`

---

### 1.3 OrganizationMembership

Joins a `User` to an `Organization` and defines their role.

Fields:

- `_id: ObjectId`
- `user: ObjectId<User>`
- `organization: ObjectId<Organization>`
- `role: 'owner' | 'admin' | 'member' | 'viewer'`
- `status: 'active' | 'invited' | 'removed'`
- `createdAt: Date`
- `updatedAt: Date`

---

### 1.4 RevenueAccount

Vendor-side account for RevenueForge/ValueSphere.

Fields (high level):

- `_id: ObjectId`
- `organization: ObjectId<Organization>` — vendor org
- `name: string`
- `externalCrmId?: string`
- `buyerOrg?: ObjectId<Organization>` — linked buyer org where known
- Plus existing domain fields (pipeline, ARR, region, etc.)

---

### 1.5 ProcurementVendor

Buyer-side vendor record for ProcurePath.

Fields (high level):

- `_id: ObjectId`
- `organization: ObjectId<Organization>` — buyer org
- `name: string`
- `vendorOrg?: ObjectId<Organization>` — if the vendor also uses Agama
- Contract and spend metadata

---

## 2. Engagement Rooms

### 2.1 EngagementRoom

Represents a shared workspace between a vendor and a buyer.

Fields:

- `_id: ObjectId`
- `title: string`
- `vendorOrg: ObjectId<Organization>` — must have `orgType` of `'vendor'` or `'both'`
- `buyerOrg: ObjectId<Organization>` — must have `orgType` of `'buyer'` or `'both'`
- `revenueAccount?: ObjectId<RevenueAccount>` — optional link for vendor side
- `procurementVendor?: ObjectId<ProcurementVendor>` — optional link for buyer side
- `status: 'active' | 'archived'`
- `createdBy: ObjectId<User>`
- `createdAt: Date`
- `updatedAt: Date`
- `lastActivityAt: Date`

Constraints:

- `vendorOrg` and `buyerOrg` must be different organisations.
- At least one of `revenueAccount` or `procurementVendor` should be set where applicable.

---

### 2.2 EngagementRoomMembership

Defines which users can access a room and with what permissions.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `user: ObjectId<User>`
- `organization: ObjectId<Organization>` — must be either `vendorOrg` or `buyerOrg` for the room
- `role: 'room_admin' | 'editor' | 'viewer'`
- `isGuest: boolean` — convenience flag, true if user has `licenseTier = 'guest'`
- `createdAt: Date`
- `updatedAt: Date`

Notes:

- A user can be in multiple rooms across multiple organisations.
- Guests are scoped to the rooms where they have memberships.

---

### 2.3 EngagementRoomInvite

Represents an invite to join a specific Engagement Room.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `email: string` — email invited
- `organization: ObjectId<Organization>` — side they are invited from (vendor/buyer)
- `role: 'room_admin' | 'editor' | 'viewer'`
- `invitedBy: ObjectId<User>`
- `status: 'pending' | 'accepted' | 'revoked' | 'expired'`
- `token: string` — secure, random token for accepting the invite
- `isGuestInvite: boolean` — true when inviting someone who does not have a full Agama license
- `createdAt: Date`
- `updatedAt: Date`

Notes:

- WorkOS is responsible for actual email delivery and auth flows.
- When a user logs in via WorkOS and presents a valid `token`, an `EngagementRoomMembership` is created or updated.

---

## 3. Communication

### 3.1 EngagementRoomMessage

A message in a room’s communication feed.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `author: ObjectId<User>`
- `body: string`
- `type: 'message' | 'system' | 'ai_summary'`
- `metadata: object` — optional (e.g. references to issues/files)
- `createdAt: Date`
- `updatedAt: Date`

---

## 4. Project Management Table (Issues)

### 4.1 EngagementRoomIssue

Represents a row in the project management table for a room.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `title: string`
- `description?: string`
- `status: 'not_started' | 'in_progress' | 'completed' | 'stuck'`
- `assignees: ObjectId<User>[]`
- `dueDate?: Date`
- `notes?: string`
- `priority?: 'low' | 'medium' | 'high'`
- `createdBy: ObjectId<User>`
- `createdAt: Date`
- `updatedAt: Date`

---

### 4.2 EngagementRoomIssueComment

Comments on issues.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `issue: ObjectId<EngagementRoomIssue>`
- `author: ObjectId<User>`
- `body: string`
- `createdAt: Date`
- `updatedAt: Date`

---

## 5. Deliverables & Milestones

### 5.1 EngagementRoomDeliverable

Represents a key deliverable or milestone.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `title: string`
- `description?: string`
- `status: 'not_started' | 'in_progress' | 'completed' | 'at_risk'`
- `owner: ObjectId<User>` — primary owner
- `relatedIssues: ObjectId<EngagementRoomIssue>[]`
- `dueDate?: Date`
- `createdBy: ObjectId<User>`
- `createdAt: Date`
- `updatedAt: Date`

---

## 6. Documents & File Collaboration

### 6.1 EngagementRoomFile

Represents a logical file in a room (with versions).

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `name: string`
- `mimeType: string`
- `currentVersion: ObjectId<EngagementRoomFileVersion>`
- `createdBy: ObjectId<User>`
- `createdAt: Date`
- `updatedAt: Date`

---

### 6.2 EngagementRoomFileVersion

Represents a single file upload version.

Fields:

- `_id: ObjectId`
- `file: ObjectId<EngagementRoomFile>`
- `storageKey: string` — key/path in storage (S3 or equivalent)
- `sizeBytes: number`
- `uploadedBy: ObjectId<User>`
- `uploadedAt: Date`

(Note: actual object storage is external to MongoDB.)

---

### 6.3 EngagementRoomFileComment

Comments on a file (optionally per version).

Fields:

- `_id: ObjectId`
- `file: ObjectId<EngagementRoomFile>`
- `version?: ObjectId<EngagementRoomFileVersion>`
- `room: ObjectId<EngagementRoom>`
- `author: ObjectId<User>`
- `body: string`
- `createdAt: Date`
- `updatedAt: Date`

---

## 7. Activity / Timeline (Optional but Recommended)

### 7.1 EngagementRoomActivity

Generic activity event for timelines and AI context.

Fields:

- `_id: ObjectId`
- `room: ObjectId<EngagementRoom>`
- `type: string` — e.g. `'message_created'`, `'issue_created'`, `'file_uploaded'`, `'deliverable_completed'`
- `actor?: ObjectId<User>`
- `payload: object` — type-specific metadata
- `createdAt: Date`

---

## 8. Permissions Summary

- Access to any room object (message, issue, file, deliverable) must:
  - Check that the current user has an `EngagementRoomMembership` for that room with an allowed `role`
- **Editors** can:
  - Create/update issues, deliverables, messages, and comments
  - Upload files
- **Viewers** can:
  - Read room content only
- **Room admins** can:
  - Do everything editors can
  - Manage memberships and invites
- **Guest users** are constrained:
  - Can only operate within rooms they belong to
  - Cannot see organisation-wide user directories or configuration
