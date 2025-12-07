# integrations.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for External Integrations  
Last Updated: (update before commit)

This document defines the complete architecture, data flows, configuration rules, and governance requirements for integrations used across Agama. It covers:

- CRM (Salesforce, HubSpot)  
- Gong  
- Clari  
- Email & Calendar (Google/Microsoft)  
- Procurement ERP  
- Contract Systems  
- Risk/Compliance Feeds  
- Identity Provider (WorkOS)  
- Future third-party connectors  

Integrations feed RevenueForge (vendor), ProcurePath (buyer), Engagement Rooms (shared artefacts), notifications, search indexing, and AI suggestion systems — always respecting strict visibility rules.

---

# 1. Integration Principles

All integrations must follow these principles:

1. **Tenant-Safe Isolation**  
   - Configuration stored per-org  
   - Sync jobs scoped to orgId  
   - No cross-org leakage  

2. **Permission-Aware Data Flow**  
   - Vendor integrations feed vendor-only data  
   - Buyer integrations feed buyer-only data  
   - Shared panels receive sanitized/explicitly published data only  

3. **Event-Driven Architecture**  
   - Syncs generate domain events  
   - Domain events feed:  
     - Engagement Rooms  
     - Notifications  
     - Audit logs  
     - Search indexing  

4. **Idempotent Sync Logic**  
   - Multiple syncs should not create duplicates  
   - Must track last sync timestamp  

5. **Fail-Safe Error Handling**  
   - Errors logged into IntegrationState  
   - Retry backoff logic  
   - Notifications for admins on failures  

6. **Auditability**  
   - All config & sync actions logged in AuditLog  

7. **AI Readiness**  
   - Integrations power AI insight generation  
   - AI must only use visibility-allowed data  

---

# 2. Integration Data Models (Summary)

Two core models govern integrations:

## 2.1 IntegrationConfig
Defined in `domain_model.md`.

Fields:
- `_id`
- `orgId`
- `type` (crm, gong, clari, email, calendar, erp, contract, risk_feed, other)
- `provider`
- `config` (safe metadata, credentials stored securely)
- `status: not_configured | configured | error`
- `lastErrorMessage?`
- `createdAt`
- `updatedAt`

## 2.2 IntegrationState
Tracks runtime state.

Fields:
- `_id`
- `orgId`
- `integrationConfigId`
- `lastSyncAt`
- `nextSyncAt`
- `lastSyncStatus: ok | error | partial`
- `lastSyncSummary?`
- `errorCount`
- `metadata?`

IntegrationState is updated after each sync job.

---

# 3. Vendor-Side Integrations (RevenueForge)

Vendor Suite users rely heavily on external systems for account intelligence.

## 3.1 CRM Integrations (Salesforce, HubSpot)

Purpose:
- Pull accounts, opportunities, contacts  
- Push selected updates (optional)  
- Sync CRM metadata into AgamaAccount  

Synced fields include:
- Account name  
- Stage  
- ARR / revenue fields  
- Owner  
- Contact list  
- Opportunities linked  
- Next steps (if available)  

CRM-specific rules:
- Salesforce requires OAuth with refresh tokens  
- HubSpot uses API keys or OAuth  
- Bi-directional sync optional but audit-logged  

## 3.2 Gong Integration

Purpose:
- Pull call recordings metadata  
- Pull transcript segments  
- Extract intent/sentiment  
- Detect competitor mentions  
- Feed InteractionLog  

Vendor-only:
- Gong-derived insights remain strictly vendor_only  

AI Usage:
- Summarise calls  
- Identify risks  
- Identify missing stakeholders  

## 3.3 Clari Integration

Purpose:
- Pull forecast risk  
- Pull opportunity health signals  
- Pull engagement trends  

Clari insights feed:
- RevenueForge healthScore  
- Vendor-only AI suggestions  

Must not appear in shared or buyer contexts.

## 3.4 Email & Calendar (Google/Microsoft)

Purpose:
- Record interaction history  
- Build stakeholder maps  
- Provide timeline insights  

Behaviours:
- Email ingestion summary only, not full content  
- Meeting metadata only (title, attendees, time)  
- Calendar events enrich InteractionLog  

Never ingest:
- Email bodies beyond safe summaries  
- Attachments without explicit user upload  

Strict privacy rules apply.

### 3.5 Credential Rotation and Secret Handling

All integration credentials must:

- Be stored exclusively in encrypted secret managers (Render → environment vars; AWS → Secrets Manager).
- Support automated rotation where possible (OAuth refresh tokens, API key rotation).
- Never be written to logs, notifications, or audit entries beyond minimal metadata.
- Trigger alerting if expired or invalid.

Codex must implement a secret abstraction layer with:
- getSecret(provider)
- updateSecret(provider)
- validateSecret(provider)


---

# 4. Buyer-Side Integrations (ProcurePath)

These integrations support procurement, vendor comparison, and compliance.

## 4.1 Procurement ERP

Purpose:
- Pull sourcing events (optional)  
- Sync vendor master data  
- Push procurement outcomes  
- Update contract metadata  

Use cases:
- CFO/Procurement Exec reporting  
- Financial workflows  

Visibility:
- Buyer-only  
- Vendor cannot see ERP context  

## 4.2 Contract Management System

Purpose:
- Sync contract drafts  
- Track signatures  
- Pull renewal dates  
- Store legal notes  

Visibility:
- Buyer-only  
- Vendor sees only what buyer explicitly publishes into shared commercial/contract folders  

## 4.3 Risk & Compliance Feeds

Examples:
- SecurityScorecard  
- BitSight  
- LexisNexis  
- AML/KYC providers  

Purpose:
- Pull vendor risk indicators  
- Track incidents  
- Enrich BuyerRiskProfile  

Visibility:
- Strictly buyer-only  
- Never visible to vendor  

Notifications:
- "Risk flag detected" → buyer only  
- Logged in AuditLog  

---

# 5. Identity Provider Integration (WorkOS)

WorkOS is Agama’s identity backbone.

Used for:
- SSO  
- SCIM (future)  
- Role provisioning  
- Magic link for internal invites (optional wrapper)  
- Domain-associated org creation  

Rules:
- WorkOS userId maps to Agama `authProviderId`  
- Invite acceptance flows depend on WorkOS authentication  
- Guests bypass WorkOS (magic link only)  

Workspace-bound identity prevents unauthorized cross-org access.

---

# 6. Sync Job Architecture

Syncs must follow a predictable flow.

## 6.1 Triggering Syncs

Syncs can be triggered by:

1. Scheduled job (cron or event-driven)  
2. User action (“Sync now”)  
3. OAuth refresh (CRM tokens renewed)  
4. System-level fallback when integration recovers  

## 6.2 Sync Execution Stages

1. Validate IntegrationConfig  
2. Check credentials  
3. Pull data from external system  
4. Transform external → Agama domain model  
5. Update relevant objects:
   - AgamaAccount  
   - InteractionLog  
   - VendorRecord (ERP)  
   - BuyerRiskProfile  
6. Update IntegrationState  
7. Trigger notifications  
8. Emit audit events  

## 6.3 Idempotency Rules

Sync logic must:
- Match objects by external ID  
- Avoid duplicate creation  
- Store last sync timestamp  
- Retry safely  

---

# 7. Data Flow into Agama

## 7.1 Vendor-Side Flows

CRM → AgamaAccount  
CRM → Stakeholders  
Gong → InteractionLog  
Clari → Account health  
Email/Calendar → InteractionLog  
Gong → Competitive signals (vendor-only)  

RevenueForge is the central place where this intelligence surfaces.

## 7.2 Buyer-Side Flows

ERP → VendorRecord  
ERP → Contract metadata  
Risk feeds → BuyerRiskProfile  
Contract tools → Legal/commercial folder in buyer-only context  

ProcurePath uses these signals for evaluation, risk management, and approvals.

---

# 8. Integration Visibility Model

Visibility is determined by:

- orgId  
- suite entitlement  
- Room participation  
- visibility flags (`vendor_only`, `buyer_only`, `shared`)  

Rules:

## 8.1 Vendor Integrations Visible ONLY to Vendor Suite Users
- CRM intelligence  
- Gong transcripts  
- Clari risk insights  
- Email/calendar metadata  

## 8.2 Buyer Integrations Visible ONLY to Buyer Suite Users
- ERP data  
- Risk feeds  
- Contract system metadata  
- Buyer-only compliance docs  

## 8.3 Shared Visibility Allowed ONLY When Published
Only sanitized content (documents, summaries) may be published to shared Room panels.

Integration data NEVER auto-publishes.

---

# 9. Integration Error Handling

When a sync fails:

1. Update IntegrationState:
   - `lastSyncStatus = error`
   - `errorCount++`
   - `lastErrorMessage = message`
2. Emit notification to:
   - Org Owner  
   - Org Admin  
   - Vendor/Buyer Super Users
3. Emit audit event  
4. Trigger retry logic with exponential backoff  

If multiple failures occur:
- System may disable integration  
- Admin must manually reconnect  

---

# 10. Notifications Driven by Integrations

Integrations trigger notifications like:

- CRM sync failure  
- CRM reconnect success  
- Gong API failure  
- Gong transcript processed  
- Clari risk alert  
- ERP sync failure  
- Contract updated  
- Risk feed alert  

All notifications follow the rules in `notifications.md`.

---

# 11. AI Use of Integration Data

AI may use integration data ONLY within the appropriate visibility scope.

## 11.1 Allowed AI Use (Vendor Side)
- Summarise CRM + Gong + Clari signals  
- Suggest qualification updates  
- Identify risk or opportunity trends  
- Suggest MAP next actions  
- Suggest next stakeholder outreach  

## 11.2 Allowed AI Use (Buyer Side)
- Summarise vendor compliance gaps  
- Flag risk from external feeds  
- Suggest comparative evaluation heuristics  

## 11.3 Forbidden AI Use
- Using buyer-only data to generate vendor-facing content  
- Using vendor-only data to generate buyer-facing content  
- Revealing integration-derived competitive intel in shared panels  
- Inferencing shortlist or scoring for vendors  
- Inferring contract financials to vendors  

AI operations must log an audit event with `actorType = "ai"`.

---

# 12. Integration UI & Settings

## 12.1 Integration Settings Page
Visible to:
- Org Owner  
- Org Admin  
- Super Users (vendor or buyer depending on integration type)

Fields:
- Provider  
- Connection status  
- “Reconnect”  
- “Sync now”  
- Logs (last sync messages)  
- Permissions (who may use)  

## 12.2 Integration Health in Dashboards
Vendor dashboard:
- CRM / Gong / Clari / Email sync health  

Buyer dashboard:
- ERP / Contract / Risk feed health  

Use theme-coloured badges:
- Green = healthy  
- Orange = warning  
- Red = failure  

---

# 13. Codex Implementation Rules

Codex MUST:

1. Implement IntegrationConfig and IntegrationState exactly as in domain_model.md.  
2. Implement OAuth flows (CRM, Gong, Clari) or API key flows where required.  
3. Implement org-scoped sync queues.  
4. Enforce visibility on integration-fed data.  
5. Emit audit events for all integration actions.  
6. Surface integration health on dashboards.  
7. Implement retry and error handling logic.  
8. Never expose external data to unauthorised participants.  
9. Support eventual migration to multi-worker integration pipeline.  
10. Treat integrations as a first-class part of the platform architecture.

---

# 14. Failure Escalation Rules

Integration failures must escalate:
- After 3 consecutive sync failures → mark integration as degraded
- After 10 consecutive failures → disable integration and require admin action
- Notify appropriate users based on suite
- Log all escalation events in AuditLog

---

# 15. Summary

Integrations are the intelligence backbone of Agama.  
They power:

- RevenueForge’s account intelligence  
- ProcurePath’s procurement workflows  
- Engagement Rooms’ shared context (sanitized only)  
- ValueSphere modelling  
- AI insights  
- Notifications  
- Audit logs  
- Search indexing  

This document defines all technical, security, and governance rules required for Codex and engineers to implement integrations safely and effectively.

---

**End of integrations.md**
