# engagement_rooms.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for Engagement Rooms  
Last Updated: (update before commit)

Engagement Rooms are the **shared collaboration layer** in Agama.  
They connect vendors and buyers in structured, permission-safe workspaces where both sides can collaborate on deals, procurement events, value modelling, documents, timelines, and RFX processes—while maintaining strict privacy boundaries.

Engagement Rooms contain three types of panels:
- Vendor-only panels (seller theme, private to vendor)  
- Shared panels (shared theme, visible to all participants)  
- Buyer-only panels (buyer theme, private to buyer)  

Guests can join Rooms but are restricted to shared panels only.

This document defines the full domain, lifecycle, user experience, permissions, publishing model, component structure, data flows, AI rules, and Codex implementation constraints for Engagement Rooms.

---

# 1. Purpose & Mission

Engagement Rooms exist to solve critical collaboration gaps:

1. Vendors and buyers lack a **shared structured workspace** aligned with the sales + procurement lifecycle.  
2. Emails, spreadsheets, docs, and shared drives create fragmentation.  
3. Vendors need transparency and structure in what they share; buyers need privacy and governance.  
4. Guests (non-customers) should be able to collaborate in a controlled environment and convert into paying customers.  
5. Value discussions, requirements, architecture, timelines, and documents must be unified and trackable.  
6. RFX workflows need a continuous, contextualised place for answering and reviewing.  

Engagement Rooms bridge RevenueForge (vendor-side) and ProcurePath (buyer-side) while acting as a structured collaboration space for both.

---

# 2. Room Model

The Room is defined in `domain_model.md` but summarised here for clarity.

## 2.1 EngagementRoom Fields
- `_id: ObjectId`
- `vendorOrgId: ObjectId`
- `buyerOrgId?: ObjectId` (nullable — buyer may be guests only)
- `vendorAccountId: ObjectId` (AgamaAccount from vendor org)
- `buyerVendorRecordId?: ObjectId` (VendorRecord from buyer org)
- `sourcingEventId?: ObjectId`
- `status: draft | active | closed | archived`
- `roomName?: string`
- `createdByUserId: ObjectId`
- `createdAt: Date`
- `updatedAt: Date`

## 2.2 Invariants
- There is always a **vendor organisation**; a buyer org may or may not exist.  
- Vendor and buyer roles are derived from **OrganizationMembership + RoomParticipant**.  
- Room visibility depends on participant roles, not just suite entitlements.

---

# 3. Room Lifecycle

- draft → active → closed → archived


## 3.1 draft
- Room created but not all participants invited  
- Vendor panels active  
- Shared panels mostly empty  
- Buyer-only panels active only if buyer org exists and buyer users have joined

## 3.2 active
- Both sides collaborating  
- All shared panels fully active  
- RFX answering and ValueSphere may be used  

## 3.3 closed
- Collaboration is complete  
- Read-only except for downloadable exports  
- Evaluation summaries may be stored (but buyer-only fields remain private)

## 3.4 archived
- Rarely modified  
- Minimal footprint  
- Used for audits and renewals  

Lifecycle transitions MUST be logged in `AuditLog`.

---

# 4. Participant Model

Participants are defined via `RoomParticipant`.

Room roles:

- `vendor_user`  
- `buyer_user`  
- `guest`  

## 4.1 Vendor Users
- Full access to vendor-only panels  
- Full access to shared panels  
- No access to buyer-only panels  

## 4.2 Buyer Users
- Full access to buyer-only panels  
- Full access to shared panels  
- No access to vendor-only panels  

## 4.3 Guests
- Access to shared panels only  
- Cannot see vendor-only or buyer-only internal content  
- Upsell prompts shown for Buyer Suite / Vendor Suite  

---

# 5. Panel Architecture

Engagement Rooms contain three groups of panels.  
Panels MUST be displayed with the correct theme token: seller / buyer / shared.

---

# 6. Vendor-Only Panels (Seller Theme)

Vendor-only panels source data primarily from **RevenueForge**.  
Nothing here is visible to buyers or guests.

## 6.1 Vendor Qualification Panel
Displays:
- Qualification framework (MEDDIC/BANT/CUSTOM)  
- Fields and values  
- Confidence indicators  
- Seller-only notes  

Actions:
- Edit qualification  
- AI “suggest next qualification items”  
- “Publish” selective items into Shared Overview (sanitized summaries only)

## 6.2 Vendor Internal MAP
Contains:
- Vendor-only tasks  
- Internal milestones  
- Dependencies  
- Escalation notes  
- Blockers  

Actions:
- Promote task → Shared MAP  
- Promote milestone → Shared MAP (sanitized)  
- AI: “Recommend next actions”

## 6.3 Vendor Architecture Drafts
Displays:
- Full architecture diagrams  
- Assumptions  
- Dependencies  
- Risks  

Actions:
- Edit  
- Create version  
- Publish version → Shared Architecture Workspace  
- AI: “Draft architecture”, “Highlight risks”

## 6.4 Vendor Competitive Strategy
Displays:
- Competitors identified  
- Strengths/weaknesses  
- Positioning  
- Battle cards  

Actions:
- Edit  
- AI: “Suggest counter strategies”  
- Never publish unless explicitly turned into sanitized shared content (rare)

## 6.5 Seller-Mode ValueSphere
Displays:
- Seller’s value assessment  
- Metrics  
- ROI/TCO narrative  
- Assumptions  

Actions:
- Edit  
- Share Summary → Shared ValueSphere (sanitized)  
- AI: “Draft executive summary”  

Vendor-only content must never leak to shared or buyer content automatically.

---

# 7. Shared Panels (Shared Theme)

Shared panels are the core of cross-organisation collaboration.

They are visible to:
- vendor_user  
- buyer_user  
- guest  

Shared panels MUST use the shared (orange) theme.

---

## 7.1 Shared Overview
Contains:
- Objectives  
- Scope  
- Phase  
- High-level health indicators  
- Key dates  
- Owner alignment  
- Shared commitments  

Vendor and buyer may both contribute content via their respective panels.

AI can generate:
- Cross-org summaries  
- High-level alignment statements  

AI must respect visibility constraints for source content.

---

## 7.2 Messages (Threaded Chat)
Features:
- Room-wide chat  
- Threaded replies  
- Attachments  
- Mentions  
- Filters (All, Threads, Unread)  

All messages are shared unless sent via vendor-only or buyer-only notes (which are not in chat).

---

## 7.3 Shared MAP (Mutual Action Plan)
The canonical MAP of the deal or procurement event.

Displays:
- Tasks from both sides  
- Milestones  
- Dependencies  
- Owners  
- Due dates  
- Status  

Actions:
- Create shared task  
- Mark tasks complete  
- Add dependencies  
- Link to room timeline  

AI can provide:
- Task recommendations  
- Deconfliction suggestions  
- “Next best actions”

---

## 7.4 Shared Architecture Workspace
Displays published architecture diagrams.

Features:
- Version history  
- Comments on areas of the diagram  
- Personas and business unit mapping  
- Integration requirements  

Vendor-only assumptions are removed before publication.

---

## 7.5 Shared Documents
Contains shared folders:
- Business  
- Technical  
- Legal  
- Commercial  
- Security  

Supports:
- Versioning  
- Previews  
- Comments  
- Tags  
- Download  
- Replace with new version  
- Publish or recall doc (buyer/vendor-specific rules)

---

## 7.6 Shared ValueSphere
Displays shared-mode value models.

Features:
- Shared scenarios  
- Agreed assumptions  
- Impact metrics  
- Executive summaries  

Actions:
- Buyers or vendors propose changes  
- AI generates:
  - Summaries  
  - Charts  
  - Comparative insights  

---

## 7.7 RFX Workspace (Shared Area)
This is where vendors answer questions and buyers review submissions.

Features:
- Full question list  
- Attachments  
- Q&A  
- Clarifications  
- Vendor answer submission  
- Buyer clarifications (shared)  

Scoring is **not** displayed here (buyer-only panel).

---

# 8. Buyer-Only Panels (Buyer Theme)

Buyer-only panels source data from **ProcurePath**.

They are visible to:
- `buyer_user` only  
- Never visible to vendors or guests  

---

## 8.1 Procurement Timeline (Internal Buyer Workflow)
Contains:
- Internal milestones  
- Review stages  
- Compliance checks  
- Approval steps  
- Dates and deadlines  

Vendor sees only the shared subset via Shared Timeline, not this.

---

## 8.2 Evaluation & Scoring
Displays:
- Per-question scores  
- Section scores  
- Overall score  
- AI scoring suggestions  
- Rubric references  
- Internal reviewer comments  

Vendor sees none of this.

---

## 8.3 Risk & Compliance
Displays:
- Buyer-only risk findings  
- Compliance checklists  
- Breach/investigation findings  
- DPA/DPIA status  
- Financial risk summaries  
- Legal review notes  

All of this is strictly buyer-only.

---

## 8.4 Buyer ValueSphere (Buyer-Mode)
Displays:
- Buyer-internal value scenarios  
- Weighted scores  
- Cost-risk-value comparisons  
- Vendor comparison context’s internal numbers  

Vendors never see internal buyer value assessments.

---

## 8.5 Vendor Comparison Context
Shows:
- List of vendors evaluated in the same Sourcing Event  
- Comparison metrics  
- Weighted matrices  
- Internal shortlist status  

Vendor sees none of this.

---

# 9. Publishing Model (Vendor → Shared, Buyer → Shared)

Publishing is the mechanism to move content from private panels into shared panels.

## 9.1 Vendor Publishing
Vendor may publish:
- Selected qualification fields  
- Selected MAP tasks  
- Architecture versions  
- ValueSphere summaries  
- Documents intended for buyers  
- Shared overview items  

Vendor must **never** publish:
- Internal risk notes  
- Internal competitive intel  
- Vendor-only MAP notes  
- Internal ValueSphere assumptions  
- Clari/Gong risk insights that are private  

## 9.2 Buyer Publishing
Buyer may publish:
- Requirements summaries  
- Shared architecture inputs  
- Shared value summaries  
- Clarifications  
- Shared MAP tasks  
- Cleaned legal/commercial documents  

Buyer must **never** publish:
- Evaluation scores  
- Risk findings  
- Shortlist decisions  
- Internal-only scenarios  
- Approval states  

### 9.3 Draft Publishing Safeguards

Before publishing vendor-only or buyer-only draft artefacts into shared panels:

1. User must confirm the action explicitly.
2. AI-assisted publishing must highlight which fields are being exposed.
3. Sensitive fields must be automatically stripped or masked prior to publication.
4. A copy of the published artefact is produced and stored as a shared version; the original draft remains isolated.
5. AuditLog entry is generated for every publish operation.

Codex must not allow backend or frontend shortcuts that bypass these safeguards.


---

# 10. RFX Integration

Engagement Rooms hold the shared portion of the RFX workflow.

Vendor sees:
- Questions  
- Clarifications  
- Their own answers  
- Attachments  

Buyer sees:
- Same as vendor, plus buyer-only scoring and evaluation panels  

Guests see:
- Questions  
- Ability to answer (if vendor guest)  
- Attachments  

AI assistance:
- Draft answers (vendor side)  
- Draft clarifications (shared)  
- MUST NOT reveal buyer scoring  

---

# 11. Timeline Events

The Room timeline shows high-level, cross-organisation events.

Events may include:
- Document uploads  
- MAP updates  
- Architecture version publication  
- RFX questions added  
- Responses submitted  
- Shared ValueSphere updates  
- Meeting notes (shared only)  

Timeline may show vendor-only or buyer-only events to users from the same side.

Timeline items respect their visibility flag:
- shared  
- vendor_only  
- buyer_only  

### 11.1 Timeline Visibility Clarification

Each timeline event must explicitly carry a visibility flag:

- `shared`
- `vendor_only`
- `buyer_only`

Timeline rendering rules:
- vendor_only events are visible only to vendor participants.
- buyer_only events are visible only to buyer participants.
- shared events are visible to all participants.

Guests may see only:
- shared events
- sanitized metadata for allowed entities

Timeline must never infer or hint at private activity by the opposite side.



---

# 12. Notifications & Activity Feed

Room-triggered events push into:

- In-app notifications  
- Dashboard surfaces  
- Activity feed panels  

Notifications respect visibility:
- Buyer-only events → only buyer users  
- Vendor-only events → only vendor users  
- Shared events → all participants  

---

# 13. AI Rules for Engagement Rooms

AI may:
- Summarise shared activity  
- Suggest next MAP tasks  
- Draft messages  
- Draft architecture summaries (shared)  
- Draft shared ValueSphere summaries  
- Suggest clarifications for RFX  

AI may NOT:
- Use vendor-only intel to generate shared or buyer-facing content  
- Use buyer-only intel to generate shared or vendor-facing content  
- Compare vendors in vendor-facing content  
- Reveal shortlist or scoring to vendors  
- Suggest negotiation tactics from buyer-only data  

AI context isolation rules must follow `roles_permissions.md` strictly.

---

# 14. UI Conventions (Engagement Rooms)

Theme usage:
- Vendor-only panels → seller theme  
- Shared panels → shared theme  
- Buyer-only panels → buyer theme  

Rules:
- Never mix themes within a panel  
- Tabs must be grouped by persona (vendor-only / shared / buyer-only)  
- Shared workspace uses orange tinted glass  
- Vendor-only panels use blue/purple  
- Buyer-only panels use green  

Layout structure:
- Left-side tab rail  
- Main workspace area  
- Optional right-side context drawer  

---

# 15. Real-Time Collaboration

Rooms use the real-time engine for:

- Messaging  
- MAP updates  
- Architecture comments  
- Document versioning indicators  
- RFX answering state  
- Timeline updates  

WebSockets or SSE required.  
All real-time updates respect permissions.

---

# 16. Exporting & Auditing

Rooms must support exporting:

- Shared documents  
- Shared MAP  
- Shared timeline  
- Shared ValueSphere summaries  
- RFX Q&A logs  

Buyer-only and vendor-only data never appear in shared or exported bundles.

Audit logs track:
- State changes  
- Publishing actions  
- RFX submissions  
- Architecture publications  
- Invite & participant changes  

---

# 17. Codex Implementation Requirements

Codex MUST:

1. Render vendor-only, shared, and buyer-only panels based on RoomParticipant role  
2. Apply correct theme token to each panel  
3. Use the domain model defined in `domain_model.md`  
4. Enforce publishing flows  
5. Respect ALL visibility rules  
6. Build RFX answering surfaces exactly as defined  
7. Use skeleton loaders for heavy surfaces (Documents, Architecture, MAP)  
8. Support real-time updates  
9. Implement Room lifecycle and states  
10. Avoid exposing private data to the wrong persona  
11. Follow `ui_conventions.md` for layout and styling  

---

# 18. Room Phase Model

Each Engagement Room must include a non-authoritative phase indicator for UX and analytics:

- discovery
- solution_design
- evaluation
- negotiation
- procurement (if linked to a sourcing event)
- implementation (optional, post-sales)
- closed

Phase is:
- Editable by vendor users
- Visible to all participants
- Never used for permissions
- Used for UI filtering, dashboards, and AI summaries

Codex must treat this as a soft label, not a state machine.

---

# 19. Summary

Engagement Rooms are:

- The cross-org collaboration layer  
- The bridge between RevenueForge & ProcurePath  
- The home of shared workflows, MAP, architecture, ValueSphere, and RFX  
- The most permission-sensitive surface in Agama  
- The strongest PLG conversion tool  
- A fully structured, real-time, enterprise-grade workspace  

This document defines the complete behaviour and structure required for Codex and engineering to implement Engagement Rooms.

---

**End of engagement_rooms.md**
