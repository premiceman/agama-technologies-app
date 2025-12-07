# audit_and_governance.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for Auditing, Compliance & Governance  
Last Updated: (update before commit)

This document defines Agama’s complete platform-wide governance model, including audit logging, compliance standards, lifecycle tracking, export requirements, and security controls.  
Audit and governance apply across all products: RevenueForge (vendor), ProcurePath (buyer), Engagement Rooms (shared), RFX, ValueSphere, notifications, and integrations.

Audit systems MUST give enterprises:
- A tamper-resistant record of activity  
- Full traceability for procurement and sales decision-making  
- Compliance with internal controls and regulatory frameworks  
- Post-event accountability and forensics  
- Confidence in multi-organisation collaboration  

---

# 1. Purpose of Audit & Governance in Agama

Agama is used in:
- Enterprise sales cycles  
- Enterprise procurement evaluations  
- Legal and commercial negotiations  
- Security, privacy, and compliance reviews  
- Executive decision-making  

Therefore Agama must provide:

1. **Complete traceability** for every meaningful action.  
2. **Immutable audit logs**, tied to users, organisations, and Room context.  
3. **Lifecycle event tracking** for deals, sourcing events, RFX, and ValueSphere.  
4. **Compliance exports** suitable for procurement/legal audit.  
5. **Granular visibility** based on persona and suite entitlements.  
6. **AI governance**, ensuring AI outputs cannot violate permissions.  

Audit and governance features are foundational — not optional.

---

# 2. AuditLog Object (Canonical Definition)

Defined in `domain_model.md`, but expanded here.

Fields:
- `_id: ObjectId`
- `orgId: ObjectId`
- `actorUserId?: ObjectId` (null if system or automation)
- `actorType: 'user' | 'system' | 'ai'`
- `entityType: string` (Room, Rfx, ValueAssessment, Document, Account, SourcingEvent, etc.)
- `entityId: ObjectId`
- `action: string`
- `before?: any`
- `after?: any`
- `metadata?: any`
- `createdAt: Date`

## 2.1 Requirements

- MUST be immutable  
- MUST never expose private buyer/vendor-only fields to opposite party  
- MUST store only metadata or diffs for large objects  
- MUST be queryable by org, user, date range, entity, action  
- MUST support pagination  
- MUST integrate with search (Phase 2)  

---

# 3. Events That Must Be Logged (Exhaustive)

Every change to an entity that influences deal/procurement workflows MUST generate an audit event.

## 3.1 Engagement Rooms
- Room created  
- Room status change  
- Participant added  
- Participant removed  
- Role changed (guest → buyer_user, etc.)  
- Vendor published item to shared  
- Buyer published item to shared  
- Architecture version published  
- Document uploaded or new version created  
- Shared MAP task created  
- Shared MAP task updated  
- Shared MAP task completed  
- RFX clarification posted  
- RFX amendment posted  
- ValueSphere shared or modified  
- Room archived  

## 3.2 RevenueForge (Vendor)
- Account created or synced  
- Qualification field updated  
- Stakeholder added or updated  
- Internal MAP task created  
- Internal MAP task updated  
- Competitive intel updated  
- Architecture draft updated  
- “Published to shared” action performed  
- Risk indicator triggered  

## 3.3 ProcurePath (Buyer)
- VendorRecord created or updated  
- SourcingEvent created or status changed  
- RFX created  
- RFX issued  
- RFX question updated (draft only)  
- RFX response received (vendor-side submission)  
- RFX scoring edited  
- RFX shortlist changes  
- Approval step completed  
- Buyer-side ValueSphere updated  
- Risk flag raised  

## 3.4 ValueSphere
- Assessment created  
- Assessment state changed (draft → shared → agreed → locked)  
- Scenario updated  
- Shared content updated  
- Buyer-only/seller-only assumptions updated  

## 3.5 User & Organisation
- User invited  
- User accepted invite  
- Role changed  
- Suite entitlements updated  
- Super User flags updated  
- Integration settings changed  
- Org settings changed  

## 3.6 Integrations
- Integration configured  
- Integration error encountered  
- Sync completed  
- Sync failed  

### 3.7 Administrative Actions (Mandatory Audit Events)

The following administrative actions must trigger audit log entries. These events are sensitive and affect organisation-wide governance.

Administrative events to log:
- User role changes (e.g., user → org_admin, org_admin → user).
- Suite entitlement changes (vendorSuite or buyerSuite updated).
- Assignment or revocation of Super User roles.
- Integration configuration changes.
- Integration credential refresh or token reset.
- Org-level security setting updates.
- Domain verification or removal.
- Organisation deletion or offboarding (future).
- User suspension, activation, or removal.
- Billing plan changes (only record metadata, not financial details).

Each administrative audit event must include:
- actorUserId
- actorType (user or system)
- affectedUserId or affectedOrgId where relevant
- oldValue and newValue snapshots (sanitised)
- timestamp


---

# 4. Visibility Rules for Audit Logs

Audit events MUST respect the same visibility rules as source entities.

## 4.1 Vendor-Only Audit Events
Visible only to:
- Vendor Suite users  
- Org Owner/Admin  

Examples:
- Qualification updates  
- Vendor-only MAP tasks  
- Internal architecture drafts  
- Competitive intel updates  

## 4.2 Buyer-Only Audit Events
Visible only to:
- Buyer Suite users  
- Buyer Org Admins  

Examples:
- RFX scoring  
- Shortlist changes  
- Approvals  
- Buyer ValueSphere edits  

## 4.3 Shared Events
Visible to:
- Vendor participants  
- Buyer participants  
- Guests (with restricted metadata)  

Examples:
- Messages  
- Shared MAP changes  
- Shared doc uploads  
- Shared ValueSphere changes  

## 4.4 Guest Visibility
Guests see:
- Only Shared event type  
- No metadata revealing org identity or user roles beyond name/avatar  

---

# 5. Lifecycle Tracking (Top-Level Objects)

The audit system must track lifecycle transitions for all major objects.

## 5.1 EngagementRoom Lifecycle
- draft → active → closed → archived  

## 5.2 RFX Lifecycle
- draft → issued → responding → evaluation → shortlist → decision → closed  

## 5.3 SourcingEvent Lifecycle
- initiated → requirements_defined → rfx_draft → rfx_issued → responding → evaluation → shortlist → negotiation → decision → contract_signed → closed  

## 5.4 ValueAssessment Lifecycle
- draft → shared → agreed → locked  

## 5.5 Task Lifecycle
- open → in_progress → blocked → done  

Each transition must log:
- Actor  
- Timestamp  
- Previous state  
- New state  

---

# 6. Governance Rules

## 6.1 Data Integrity & Tamper-Resistance
- Audit logs must be append-only  
- No delete or update features  
- Redactions allowed only for compliance reasons (must be logged)  

## 6.2 Exportability
Buyer orgs must be able to export:
- RFX event logs  
- Evaluation logs  
- Shared Room logs  
- Contract negotiation logs  
- ValueSphere shared summaries  

Vendor orgs must be able to export:
- Shared Room logs  
- Vendor-only Room logs  
- Qualification history  
- Architecture publication history  

Guest users cannot export anything.

## 6.3 Compliance Compatibility
Audit system must support:
- Procurement governance  
- Legal discovery  
- Information security review  
- SOC2  
- ISO27001  
- GDPR/DSR requests (data subject access)  

## 6.4 Retention Rules
Retention policy:
- Default: 7 years  
- Configurable for enterprise plans  
- Must support “legal hold” flags  

---

# 7. Audit Trails in Engagement Rooms

Engagement Rooms are the highest-density collaboration area.

Audit events MUST include:

Events recorded with:
- actorUserId  
- event type  
- entity affected  
- before/after (sanitized)  
- timestamp  

Shared events must not reveal:
- Vendor-only MAP details  
- Buyer-only scoring  
- Internal assumptions  

Private events must not appear in shared audit trails.

---

# 8. RFX Governance

RFX requires extremely high audit standards.

Audit log must track:
- Every question modification  
- Every section modification  
- Every rubric addition  
- Every response submission  
- Every scoring change  
- Every evaluation comment  
- Every shortlist update  
- Every decision justification change  

No vendor must ever see buyer-only evaluation logs.  
Shared logs must be sanitized.

---

# 9. ValueSphere Governance

ValueSphere requires:

- Audit logging of all assumptions  
- Audit logging of scenario changes  
- Audit logging of shared publications  
- Full separation of:
  - Buyer-only  
  - Vendor-only  
  - Shared content  

Shared ValueSphere logs must hide:
- Internal weightings  
- Internal scoring  
- Internal risk adjustments  

---

# 10. Integration Governance

Integrations must be auditable:

Record:
- Integration setup  
- Secrets update  
- Sync status change  
- Sync error  
- Reconnect events  

System must NOT log sensitive credentials, only metadata.

---

# 11. Observability Requirements

Agama MUST provide:
- Metrics (latency, throughput, real-time connections)  
- Logs (errors, warnings, permission failures)  
- Audit reconciliation (audit count vs domain events count)  
- Alerting for failures in audit pipeline  

---

# 12. Redaction Rules

Under GDPR/DSR or compliance review, it may be necessary to redact sensitive personal data.

Redaction must:
- Mask specific fields  
- Replace content with placeholder  
- Log redaction event  
- Never remove audit chain integrity  

Example:
“emailAddress: redacted due to GDPR request”.

---

# 13. Export Formats

Exports must be produced in:
- JSON (raw structured data)  
- CSV (summaries)  
- PDF (beautifully formatted, enterprise decision record)  

Exports must respect:
- Visibility rules  
- Tenant isolation  

---

# 14. AI Governance

AI interactions must be governed and logged.

## 14.1 AI Must Log:
- When it generates a summary  
- When it drafts ValueSphere content  
- When it suggests RFX answers  
- When it suggests RFX scoring (buyer-only)  
- When it detects risk  
- When it autofills qualification  

## 14.2 AI Must NOT:
- Reveal buyer-only content to vendors  
- Reveal vendor-only content to buyers  
- Synthesize shared content using private context  
- Modify data without explicit user confirmation  

AI audit log entries must identify:
- actorType = "ai"  
- Source inputs  
- Output summary  

---

# 15. Backend Requirements (Codex Implementation)

Codex MUST:

1. Implement AuditLog for all persistent changes.  
2. Enforce visibility filtering on audit queries.  
3. Provide APIs for:
   - Query by org  
   - Query by Room  
   - Query by entity  
   - Query by user  
   - Query by date range  
4. Ensure immutability of records.  
5. Integrate AuditLog with Notification system.  
6. Add audit events for all state transitions.  
7. Implement export tooling.  
8. Prevent audit logs from containing restricted data.  
9. Fully support multi-org isolation.  
10. Track AI involvement using explicit metadata.  

---

# 16. Summary

Agama’s audit and governance layer ensures:

- Complete traceability  
- Compliance-grade event tracking  
- Separation of shared vs private histories  
- Explicit lifecycle tracking  
- Fully permission-aware logging  
- AI accountability  
- Exportable decision evidence  

Every workflow in the platform depends on this system for enterprise trust and security.

---

**End of audit_and_governance.md**
