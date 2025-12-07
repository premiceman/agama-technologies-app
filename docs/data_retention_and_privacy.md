# data_retention_and_privacy.md — Agama Technologies
Version: 1.0  
Status: Authoritative Data Privacy & Retention Policy

This document defines data retention, deletion, redaction, and privacy rules for Agama.  
All storage, backup, export, and deletion behaviour MUST follow this specification.

---

## 1. Principles

1. Data minimisation: only store what is needed.
2. Tenant isolation: no cross-tenant leakage.
3. Transparency: administrators understand what is stored and for how long.
4. Compliance: policies compatible with GDPR, SOC2, ISO-like requirements.
5. Auditability: all critical actions logged in `AuditLog`.
6. Safety: defaults favour retention for audit unless explicit deletion is required.

---

## 2. Retention Rules By Entity

Durations are defaults; enterprise plans may request custom policies.

### 2.1 Engagement Rooms

- Default retention: indefinitely.
- Data includes:
  - Room metadata
  - Participants
  - RoomTasks
  - RoomDocuments and versions
  - RoomMessages
  - Shared ValueSphere snapshots
  - RFX links

Deletion rules:
- When a Room is deleted by an org admin:
  - Shared documents deleted from storage.
  - Tasks and messages removed.
  - Detached from RFX and SourcingEvents.
  - Corresponding AuditLog entries remain.

### 2.2 RFX and Evaluations

- Default retention: minimum 7 years.
- Includes:
  - RFX structure
  - Vendor responses
  - Buyer scoring and evaluations
  - Clarifications and amendments
  - Decision records

Rationale:
- Required for procurement audit and legal defense in many enterprises.

### 2.3 ValueSphere Data

- Seller-mode:
  - Indefinite retention unless vendor org requests removal.
- Buyer-mode:
  - Minimum 7 years by default.
- Shared-mode:
  - Retained as long as Room exists or as defined by room retention policy.

### 2.4 User Profiles and Memberships

- `User` and `UserProfile`:
  - Retained until the user is deleted under GDPR or by admin.
- `OrganizationMembership`:
  - Retained as long as the org exists.
  - When a user leaves an org, membership is marked inactive but not immediately deleted.

### 2.5 Notifications

- Default retention: 1 year.
- After that:
  - Notification content is deleted.
  - Summary counts may remain for analytics in anonymised form.

### 2.6 Integration Logs

- Default retention: 90 days.
- Data includes:
  - Provider
  - Status
  - Error summaries
- Credentials and secrets are never logged.

### 2.7 Audit Logs

- Default retention: minimum 7 years.
- Audit logs are immutable and cannot be edited or selectively deleted.

---

## 3. Deletion and Redaction

### 3.1 Types of Deletion

- Soft deletion:
  - Mark entity as deleted but leave data intact, hidden from UI.
- Hard deletion:
  - Permanently remove data from primary storage.

### 3.2 GDPR Data Subject Requests

For user deletion (right-to-be-forgotten):

- Replace `UserProfile.name` with “Deleted user”.
- Clear contact details (email, phone, department).
- Remove any direct PII from RoomMessages and comments where practical.
- Keep `User._id` references in AuditLog for consistency, but mask personal fields.

### 3.3 Document Deletion

When a document is deleted by a user with permission:

- Remove file from storage (S3 or equivalent).
- Retain RoomDocument metadata with a flag:
  - `deleted: true`
- AuditLog entry must record deletion.

### 3.4 RFX and Evaluations

- Due to audit requirements, RFX and evaluation data are usually not deleted, but may be:
  - Redacted for specific PII or sensitive details.
  - Masked at field level if required by regulation.

---

## 4. Backups and Disaster Recovery

### 4.1 Backup Frequency

- Daily full backups of primary databases.
- Regular snapshot backups of document storage.

### 4.2 Backup Retention

- Minimum 30 days of backups.
- Longer retention depending on plan or contract.

### 4.3 Restore Scope

- Restoring is done at:
  - Entire environment level, or
  - Per-org snapshot level (where supported).

Individual user-level restores are not supported.

---

## 5. PII and Sensitive Data Handling

PII includes, but is not limited to:

- Full name
- Email address
- Phone number
- IP address
- Org-specific personal metadata

Handling rules:

- Encrypt at rest using database or storage encryption.
- Never log PII to application logs.
- Avoid including PII in search indexes beyond what is needed.
- Redact PII where required by law or contract.

---

## 6. Visibility and Privacy Boundaries

- Vendor-only:
  - Visible only to vendor org members with appropriate role.
- Buyer-only:
  - Visible only to buyer org members with appropriate role.
- Shared:
  - Visible to vendor, buyer, and guests in a Room.
- AI operations must always follow the same visibility logic.

---

## 7. Export Behaviour

Exports must:

- Respect visibility:
  - Vendor exports: vendor-only and shared data only.
  - Buyer exports: buyer-only and shared data only.
- Mask or remove PII as agreed in customer contract.
- Log export events in AuditLog with:
  - actorUserId
  - orgId
  - timestamp
  - summary of exported scope

---

## 8. Data Residency and Localisation (Future-Proofing)

This section is for future implementation but must be considered:

- Region-based data residency (for example EU vs US).
- Ensuring that orgs can choose data region.
- Cross-region replication rules.

---

## 9. Summary

This document defines how Agama retains, deletes, redacts, and protects data.  
Any code that affects lifecycle of core entities MUST be checked against these policies before implementation.
