# ai_context_model.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative AI Context & Safety Specification  
Last Updated: (update before commit)

This document defines the **AI context, safety, and permission model** for Agama.

It centralises all cross-cutting rules that govern how AI features may access data from:

- RevenueForge (vendor suite)  
- ProcurePath (buyer suite)  
- Engagement Rooms (shared)  
- ValueSphere (seller mode, buyer mode, shared mode)  
- RFX framework  
- Notifications  
- Collaboration Engine  
- Integrations (CRM, Gong, Clari, ERP, risk feeds)  

All AI features MUST comply with this document in addition to the product-specific rules in:

- `revenueforge.md`  
- `procurepath.md`  
- `engagement_rooms.md`  
- `valuesphere.md`  
- `rfx_framework.md`  
- `notifications.md`  
- `collaboration_engine.md`  
- `integrations.md`  
- `audit_and_governance.md`  

If any conflict arises, **`ai_context_model.md` is the ultimate reference**.

---

## 1. AI Roles in Agama

AI in Agama is always:

1. **Assistive** – AI suggests, drafts, summarises, or highlights; it never acts as an authoritative decision-maker.  
2. **Scoped** – AI only sees data permitted to the current user and context.  
3. **Audited** – AI actions that change or propose changes to data are logged.  
4. **Safe by default** – If in doubt, AI must NOT answer or must reduce scope.  

AI is not a super-user. It must obey exactly the same visibility rules as the user on whose behalf it is acting.

---

## 2. Core Context Types

Agama uses three core visibility contexts:

- `vendor_only`  
- `buyer_only`  
- `shared`  

Plus one implicit context:
- `public` (e.g. documentation, static content; rarely relevant here)

### 2.1 vendor_only Context

Includes:

- RevenueForge qualification fields marked vendor_only  
- Internal vendor MAP tasks  
- Competitive intel  
- Seller-mode ValueSphere internal fields  
- Clari risk signals (vendor perspective)  
- Gong transcripts and call summaries (vendor view)  
- Vendor-only architecture drafts  
- Internal notes in RFX context  

AI may access vendor_only context **only when**:

- The user is operating as a vendor-side user (Vendor Suite)  
- The operation is vendor-facing (e.g., seller email drafting, vendor-only summary)  

AI is strictly forbidden from:

- Using vendor_only context to produce buyer-facing or shared content.  

### 2.2 buyer_only Context

Includes:

- Buyer-internal RFX scoring  
- Shortlist decisions  
- Risk & compliance findings  
- Buyer-mode ValueSphere internal fields  
- ProcurePath internal notes  
- Buyer-only MAP tasks  
- Approval status and comments  
- Vendor comparison matrices  

AI may access buyer_only context **only when**:

- The user is operating as a buyer-side user (Buyer Suite)  
- The operation is buyer-facing (internal evaluation, justification)  

AI is strictly forbidden from:

- Using buyer_only context to produce vendor-facing or shared content.  

### 2.3 shared Context

Includes:

- Shared MAP tasks  
- Shared documents  
- Shared architectures  
- Shared ValueSphere assessments  
- RFX questions and answers (but not scoring)  
- Shared Room messages  
- Shared timeline events  

AI may use shared context freely for shared outputs, provided:

- It does not infer or reveal private vendor_only or buyer_only information.  

---

## 3. Global AI Rules (Hard Constraints)

These apply across the entire platform.

1. **Never cross private contexts:**  
   - Never use vendor_only context to produce buyer-visible output.  
   - Never use buyer_only context to produce vendor-visible output.  

2. **Shared outputs must be constructed only from shared context plus public knowledge.**

3. **AI must never reveal:**
   - RFX scores, vendor rankings, shortlist decisions.  
   - Internal buyer risk assessments.  
   - Internal vendor risk assessments or strategies.  
   - Non-published architecture assumptions.  
   - Internal commercial models, discounts, or pricing strategies.  

4. **AI must not fabricate or guess restricted information.**  
   If required context is not accessible, AI must state that limitation.

5. **All AI operations that affect data or user perception must be logged in `AuditLog` with `actorType = "ai"`.**

---

## 4. AI Context Matrix by Surface

This section summarises what context AI is allowed to use per product surface and persona.

### 4.1 RevenueForge (Vendor Suite)

User type: vendor

Allowed AI context:

- Vendor-only context:
  - CRM-synced account data  
  - Gong/Clari signals  
  - Vendor qualification fields  
  - Vendor-only MAP tasks  
  - Vendor architecture drafts  
  - Seller-mode ValueSphere internal fields  
- Shared context where vendor has access (e.g., shared Room activity)  

Forbidden:

- Buyer-only data of any kind  
- RFX scoring  
- Buyer vendor comparisons  
- Buyer risk/compliance assessments  

Example allowed tasks:

- Summarise last week’s vendor interactions with an account  
- Suggest next steps for vendor MAP  
- Extract competitor patterns from Gong transcripts  
- Draft seller-side value narrative  

### 4.2 ProcurePath (Buyer Suite)

User type: buyer

Allowed AI context:

- Buyer-only context:
  - RFX questions and responses  
  - Evaluation scores  
  - Risk profiles  
  - Approval status  
  - Buyer-mode ValueSphere fields  
- Shared context (e.g., shared docs or shared Room events)  

Forbidden:

- Vendor-only RevenueForge fields  
- Seller-mode ValueSphere assumptions  
- Vendor-internal MAP tasks  
- Vendor competitive intel  

Example allowed tasks:

- Summarise vendor responses for security section  
- Suggest scoring ranges based on rubric  
- Highlight risk flags in responses  
- Draft procurement justification for internal stakeholders  

### 4.3 Engagement Rooms

Three primary personas: vendor_user, buyer_user, guest.

#### Vendor in Room

AI may use:
- vendor_only + shared context (for vendor-facing output)  

AI must not:
- Use buyer_only to create vendor-facing content  

#### Buyer in Room

AI may use:
- buyer_only + shared context (for buyer-facing output)  

AI must not:
- Use vendor_only to create buyer-facing content  

#### Guest in Room

AI may use:
- Shared context only  

AI must not:
- Use vendor_only or buyer_only context at all  

Example shared tasks:

- Summarise Room activity for all participants  
- Suggest shared MAP follow-ups  
- Summarise shared ValueSphere content  

### 4.4 Allowed and Forbidden AI Transformations

The following examples clarify exactly how AI may transform data within its permitted context.

#### Allowed (Vendor User)
- Summarise recent vendor-only interactions into a vendor-only summary.
- Draft a qualification update using only vendor-only fields.
- Suggest next steps using vendor interactions and shared MAP items.

#### Forbidden (Vendor User)
- Summarise buyer scoring or evaluation data.
- Infer buyer shortlist status.
- Refer to buyer risk flags or compliance data.
- Generate any shared output that contains vendor-only assumptions or insights.

#### Allowed (Buyer User)
- Summarise vendor responses for internal evaluation.
- Suggest scoring based on the rubric.
- Analyse risk using buyer-only data and integrated risk feeds.

#### Forbidden (Buyer User)
- Refer to vendor-only qualification notes.
- Reveal competitive analysis originating from vendor-only context.
- Generate any shared output whose content is derived from buyer-only scoring or internal assumptions.

#### Allowed (Shared Context)
- Produce a high-level summary of shared MAP progress.
- Generate a shared ValueSphere scenario using shared fields only.
- Summarise shared documents and shared messages.

#### Forbidden (Shared Context)
- Infer or leak vendor-only or buyer-only details.
- Reference internal MAP tasks.
- Reference scoring, shortlist decisions, or internal qualification fields.

---

## 5. AI in ValueSphere

ValueSphere specifics:

### 5.1 Seller-Mode

Context:
- Vendor-only seller template and responses  
- Discovery notes  
- Internal scenario modelling  

Allowed outputs:

- Seller-facing narratives  
- Seller-only scenario notes  
- Internal seller suggestions  

Publishing to shared:

- AI can assist in creating sanitized summaries  
- Must not include vendor_only fields flagged as private  

### 5.2 Buyer-Mode

Context:
- Buyer-only buyer template and responses  
- Internal weights and scoring  
- Multi-vendor comparisons  

Allowed outputs:

- Buyer-only evaluation narratives  
- Buyer-only scenario comparisons  
- Justifications for approvals  

Publishing to shared:

- AI-generated shared summaries must be based solely on shared-compatible fields (if any).  

### 5.3 Shared-Mode

Context:
- Shared template data only  

Allowed outputs:

- Collaborative summaries  
- Joint value proposals  

Forbidden:

- Inject internal buyer-only or vendor-only assumptions into shared text.  

---

## 6. AI in RFX Framework

RFX specifics:

### 6.1 Vendor-Side AI in RFX

Allowed context:
- Vendor’s own responses  
- Shared RFX questions and clarifications  
- Shared documents in the Room  

Allowed tasks:
- Draft vendor answers  
- Spot contradictions in vendor’s answers  
- Suggest attachments or references  

Forbidden:
- Access buyer scoring, rubric internal comments, or other vendors’ responses  

### 6.2 Buyer-Side AI in RFX

Allowed context:
- All RFX questions  
- All vendor responses to the buyer’s RFX  
- Buyer-only scoring fields and rubrics  
- Risk data from integrations  
- Buyer-only comments  

Allowed tasks:
- Suggest question improvements (draft mode)  
- Suggest scoring  
- Highlight anomalies and risk  
- Compare vendor responses  

Forbidden:
- Reveal scoring to vendors or guests  
- Reveal vendor ranking in vendor-facing outputs  

### 6.3 Shared RFX AI

Shared context only:

- Questions  
- Clarifications  
- Instructions  

Allowed tasks:
- Draft clarifications  
- Summarise RFX requirements for both sides  

Forbidden:
- Use buyer-only scoring or vendor-only context in shared messaging.  

---

## 7. AI in Notifications

AI can generate or enrich notifications only using:

- Context allowed for the recipient’s role and suite  
- Shared or private content consistent with that role  

Examples:

- “You were mentioned in Room X, in the Shared MAP section.”  
- “Two tasks assigned to you are due tomorrow.”  
- “Your RFX draft response has incomplete mandatory questions in section Security.”

AI must not:

- Signal buyer-only insights to vendors  
- Reveal internal risk thresholds  
- Mention shortlists or internal scoring in vendor notifications  

---

## 8. AI Logging & Audit

Every AI action that:

- Writes data to the database, or  
- Produces content presented as a system suggestion

must create an `AuditLog` entry with:

- `actorType: "ai"`  
- `actorUserId`: the user on whose behalf the AI operated  
- `entityType` and `entityId`  
- `action` (e.g., "ai_summarised_room", "ai_drafted_rfx_answer")  
- Optional minimal `before` / `after` snapshots (sanitized)  
- Timestamp  

---

## 9. Failure Modes & Safe Defaults

If AI:

- Lacks sufficient context (because of permissions), or  
- Would have to use disallowed context to answer,

it must:

1. Decline with a safe message (e.g., “This information is not available in this context.”), or  
2. Answer using only the subset of allowed context and explicitly state limitations.  

Under no circumstances should AI “hallucinate” restricted information.

### 9.1 Graceful Degradation Requirement

When AI lacks sufficient context to complete a task due to permission boundaries, restricted visibility, or incomplete shared data, it must degrade gracefully by:

1. Producing a minimal safe response, or
2. Declining with a clear explanation that required context is unavailable.

AI must never fabricate restricted or unknown information to fill gaps.


---

## 10. Codex Implementation Requirements

Codex MUST:

1. Implement AI calls via a **single AI service layer** that enforces this context model.  
2. Never directly call AI from deep feature code with raw data; always go through AI context sanitisation.  
3. Attach context flags (`vendor_only`, `buyer_only`, `shared`) to all data passed to AI.  
4. Strip or mask disallowed fields before constructing prompts.  
5. Implement separate prompt templates per surface (RevenueForge, ProcurePath, Rooms, RFX, ValueSphere).  
6. Log AI operations in AuditLog with `actorType = "ai"`.  
7. Respect per-user permission checks before returning AI output.  
8. Ensure AI outputs do not override user decisions without explicit confirmation.  
9. Provide clear UX that AI content is suggested, not authoritative.  

---

## 11. Summary

This AI Context Model ensures:

- Vendor-only and buyer-only boundaries are never crossed.  
- Shared content remains safe and neutral.  
- AI is assistive and auditable.  
- Every product surface uses AI in a way that respects the overall Agama architecture.  

All future AI features MUST be designed against this file before implementation.

---

**End of ai_context_model.md**
