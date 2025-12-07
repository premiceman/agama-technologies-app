# rfx_framework.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for RFX (RFP/RFQ/RFI) Framework  
Last Updated: (update before commit)

The RFX Framework is the **structured procurement engine** within Agama.  
It enables buyers to create, issue, manage, evaluate, and compare vendor responses to formal Requests for Proposal (RFP), Requests for Quote (RFQ), or Requests for Information (RFI).

Vendors respond to RFXs inside Engagement Rooms.  
Buyers evaluate responses inside ProcurePath.  
Guests may participate under restricted conditions.

This document defines the complete RFX data model, workflows, permission model, AI behaviour, Room integration, UI patterns, and Codex implementation rules.

---

# 1. Purpose & Mission of RFX Framework

RFX solves the following procurement problems:

1. RFX processes occur in Word/Excel/email → no structure.  
2. Vendor responses are unstructured and incomparable.  
3. Scoring and evaluation have no clear history or auditability.  
4. Internal stakeholder participation is fragmented.  
5. Vendors cannot collaborate effectively across engagements.  
6. Buyers cannot issue clarifications cleanly.  
7. No controlled way to manage amendments.  
8. No integrated place to manage RFX inside a collaboration environment.

Agama makes RFX:

- structured  
- comparable  
- transparent  
- collaborative  
- AI-augmented  
- fully auditable  

---

# 2. RFX Concepts

The RFX engine includes:

- **Rfx** (the container event)
- **RfxSection**
- **RfxQuestion**
- **RfxResponse** (vendor answers)
- **RfxEvaluation** (buyer scoring)
- **RfxAmendment** (optional future extension)
- **Clarifications** (shared Q&A)
- **AI scoring & analysis**
- **Room integration**

All entities follow the domain structure defined in `domain_model.md`.

---

# 3. RFX Lifecycle

RFX moves through the following states:

 - draft → issued → responding → evaluation → shortlist → decision → closed


## 3.1 draft
- Can be edited freely  
- Internal collaboration only  
- Buyer-only visibility  
- AI suggestions allowed  
- Vendors cannot see anything yet

## 3.2 issued
- Vendors notified  
- RFX becomes visible in shared Room panels  
- RFX cannot be structurally changed unless via amendment  
- Deadline countdown begins  

## 3.3 responding
- Vendors submit answers  
- Vendors can modify answers until deadline  
- Buyers cannot score until responding is closed  

## 3.4 evaluation
- Buyer scoring begins  
- Buyer-only scoring panel activated  
- Vendors cannot edit answers  
- AI suggestions for scores/flags become available  

## 3.5 shortlist
- Buyer marks shortlisted vendors (buyer-only)  
- Shortlist status is never shared with vendors  
- Comparison UI activated  

## 3.6 decision
- Approvals triggered  
- Final scoring and justifications prepared  
- Vendor notifications sent for outcomes (sanitized)  

## 3.7 closed
- Read-only  
- Results archived  
- Auditable history preserved  

---

# 4. Rfx Entity Specification

The Rfx object defines the structure of a single RFX event.

Fields include:

- `_id`
- `orgId` (buyer org)
- `sourcingEventId`
- `topicArea`
- `overallWeight`
- `status`
- `issuedAt`
- `closeResponsesAt`
- `createdByUserId`
- `updatedAt`

Additional behaviour:

- RFX templates may pre-populate sections/questions  
- All changes in draft mode are versioned  
- Issuing locks structure  
- Amendments create child-version references  

---

# 5. RfxSection Specification

Sections group questions by topic.

Fields include:
- `_id`
- `rfxId`
- `title`
- `description`
- `weight`
- `order`

Weighting:
- Section weight influences final scoring  
- Buyers can adjust weight in draft mode  
- AI may suggest weight recalibration based on domain  

---

# 6. RfxQuestion Specification

Questions are the core of RFX.

Fields include:

- `_id`
- `sectionId`
- `rfxId`
- `prompt`
- `type` (text, numeric, multi, boolean, attachment)
- `options` (for multi/select)
- `weight`
- `evaluationRubric`
- `tags[]`
- `required`
- `order`

Buyer-side rules:
- Questions may be reordered in draft mode  
- Every question must have a rubric for scoring consistency  
- Required questions must block submission if unanswered  

Vendor-side rules:
- Vendors can see the full question, type, and attachments  
- Vendors can only answer using the provided question type  
- Vendors cannot see rubric or weight  

---

# 7. RfxResponse Specification (Vendor-Side)

Responses contain structured vendor answers.

Fields include:

- `_id`
- `roomId`
- `rfxId`
- `questionId`
- `vendorOrgId`
- `buyerOrgId`
- `answerText`
- `answerNumeric`
- `answerOptions[]`
- `attachments[]`
- `submittedByUserId`
- `submittedAt`
- `autoScore` (buyer-only)
- `reviewScore` (buyer-only)
- `buyerComments[]` (buyer-only)

Vendor rules:
- Can modify responses until deadline  
- Cannot see scoring, comments, or comparison  
- Cannot see buyer-only context  

---

# 8. RfxEvaluation Specification (Buyer-Side)

Buyer evaluation includes:

Fields:
- `_id`
- `rfxId`
- `vendorRecordId`
- `orgId`
- `scoresBySection[]`
- `overallScore`
- `riskFlags[]`
- `recommendation`
- `createdByUserId`
- `createdAt`

Evaluation process:
1. Buyer reviewers score individual questions  
2. Weighted total is computed  
3. AI may propose draft scores  
4. Buyer finalises scores  
5. Shortlist decisions created (buyer-only)  
6. Comparison dashboard activated  

No evaluation outputs are ever visible to vendors.

---

# 9. Clarifications & Q&A

Clarifications allow vendors to ask questions, and buyers to respond, inside the Room's shared RFX workspace.

Rules:
- Clarifications are shared (visible to all Room participants)  
- Clarifications must not contain buyer scoring or internal notes  
- Amendments triggered by clarifications update RFX structure (buyer-driven)  
- AI can help suggest shared clarifications, but not buyer-only responses

---

# 10. Amendments (Optional Future Extension)

RfxAmendment object (future-ready):

- amendmentId  
- rfxId  
- changes[] (add/remove/edit questions)  
- version  
- createdAt  
- reason  

Amendments are:
- Visible to vendors  
- Trigger notifications  
- Auto-update Room RFX displays  

Buyers must confirm amendments before issuance.

---

# 11. Room Integration Model

RFX appears in **shared panels** for vendors, buyers, and guests.

## 11.1 Vendor View (Shared)
Vendors see:
- RFX topic  
- Sections  
- Questions  
- Clarifications  
- Their own responses  
- Deadlines  
- Attachments  

Vendors do NOT see:
- Scoring  
- Comments  
- Shortlist  
- Comparative data  
- Reviewer identities  

## 11.2 Buyer View (Shared + Buyer-Only)
Buyers see everything vendors see, plus buyer-only panels:
- Buyer scoring interface  
- Reviewer notes  
- AI scoring suggestions  
- Comparison dashboards  
- Shortlist builder  
- Approval integration  

## 11.3 Guest View (Shared only)
Guests see:
- Questions  
- Clarifications  
- Ability to answer (if vendor guest)  

Guests cannot:
- See buyer-only items  
- Score anything  
- Modify RFX structure  

---

# 12. Weighting & Scoring Logic

The RFX scoring framework must support:

## 12.1 Levels of Weighting
1. Overall RFX weight  
2. Section weight  
3. Question weight  
4. AI confidence weighting (optional, non-binding)  

## 12.2 Scoring Formula (Conceptual)
Overall score = sum( sectionWeight * sum( questionWeight * reviewScore ) )

AI may:
- Suggest weights  
- Highlight inconsistencies  
- Detect suspicious responses  
- Suggest normalisation  

AI may NOT:
- Auto-finalise scores  
- Reveal scoring to vendors 

## 12.3 Question Dependencies (Conditional Logic)

Questions may depend on previous answers.

Rules:

- A question may include `dependsOn: { questionId, expectedValue }`.
- Dependent questions remain hidden until conditions are met.
- Only buyers can configure dependencies.
- Vendors see dependencies only as conditional UI flow, not structural details.

## 12.4 Vendor Answer Confidence Levels

Vendors may optionally provide a confidence rating for text or numeric responses (0–100).

Purpose:

- Helps buyers identify uncertainty areas.
- AI may flag low-confidence answers for clarification.

Confidence scores remain visible to buyers only and are never shown in shared summaries.



---

# 13. Multi-Vendor Comparison Engine (Buyer-Only)

Comparison dashboard supports:

- Side-by-side question comparisons  
- Weighted score charts  
- Risk overlays  
- Scenario scoring (with ValueSphere inputs)  
- Highlighting outlier responses  
- AI summaries  

Vendors see none of this.

---

# 14. Publishing Rules (Shared vs Private)

## 14.1 Vendor → Shared
Allowed:
- Answers  
- Clarifications  
- Attachments  

Not allowed:
- Vendor-only notes  
- Internal MAP items  

## 14.2 Buyer → Shared
Allowed:
- Clarifications  
- RFX amendments  
- Requirements documents  

Not allowed:
- Scores  
- Comments  
- Rankings  
- Shortlist  

---

# 15. UI Specifications

## 15.1 Shared RFX Workspace
Components:
- Sectioned question list  
- Answer entry forms  
- Clarification module  
- Upload field  
- Deadline countdown  
- Submit button  

Theme:
- Shared theme (orange)

## 15.2 Buyer Scoring Panel
Components:
- Question list  
- Answer viewer  
- Scoring input (numeric/scale)  
- Rubric viewer  
- Reviewer comments  
- AI suggestions panel  
- Summary sidebar  

Theme:
- Buyer theme (green)

## 15.3 Vendor RFX Panel
Components:
- Questions list  
- Answer editor  
- Attachments  
- Submitted status badges  
- AI answer draft helper (vendor-only)  

Theme:
- Seller theme (blue/purple)

---

# 16. AI Usage

AI provides assistance, not authority.

## 16.1 Seller-Side AI
Allowed:
- Drafting answers  
- Detecting inconsistencies in vendor content  
- Suggesting attachments  
- Summarising question context  

Forbidden:
- Accessing buyer-only information  
- Accessing RFX scoring  
- Accessing competitor responses  

## 16.2 Buyer-Side AI
Allowed:
- Draft scoring  
- Summarising large responses  
- Flagging risk  
- Suggesting evaluation patterns  

Forbidden:
- Using vendor-only context  
- Revealing private buyer context in shared material  

## 16.3 Shared-Side AI
Allowed:
- Summarising shared content  
- Drafting clarifications  
- Highlighting information gaps  

Forbidden:
- Combining buyer-only and vendor-only content  
- Inferring vendor rankings  

---

# 17. Notifications

When RFX events occur, notify users based on visibility:

- RFX issued → vendors  
- Clarification posted → all Room participants  
- Amendment made → vendors and buyers  
- Response submitted → buyers  
- Evaluation completed → buyers  
- Decision reached → vendors (sanitized)

Notifications must follow the notification model defined in `notifications.md`.

---

# 18. Audit Requirements

AuditLog must capture:

- RFX creation  
- Section/question creation  
- Issuance  
- Amendments  
- Clarifications  
- Responses  
- Scoring  
- Shortlist decisions  
- Final decisions  
- Publishing actions  

Audit events must never include restricted fields (e.g., competitor scores).

---

# 19. Codex Implementation Requirements

Codex MUST:

1. Implement full RFX lifecycle as specified  
2. Enforce all visibility boundaries  
3. Apply correct themes to RFX panels  
4. Use domain model from `domain_model.md`  
5. Build question/section editors  
6. Build scoring interfaces  
7. Implement shared RFX workspace in Rooms  
8. Respect publish/non-publish rules  
9. Integrate with ValueSphere in buyer-mode  
10. Implement multi-vendor comparison dashboard  
11. Support amendments  
12. Log all RFX actions  
13. Prevent cross-context AI leaks  
14. Use skeleton loaders for heavy lists  

---

# 20. Summary

The RFX Framework is the backbone of structured vendor evaluation in Agama.

It includes:

- Full authoring  
- Issuance  
- Response collection  
- Scoring  
- Comparison  
- AI assistance  
- Buyer-only privacy  
- Shared collaboration in Engagement Rooms  

This document is the complete blueprint for rebuilding RFX in full.

---

**End of rfx_framework.md**
