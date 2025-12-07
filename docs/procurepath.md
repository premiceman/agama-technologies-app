# procurepath.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for Buyer Intelligence (Buyer Suite)  
Last Updated: (update before commit)

ProcurePath is the **buyer-side command centre** of Agama.  
It centralises vendor records, sourcing events, RFX creation and evaluation, approval workflows, risk and compliance processes, buyer-only ValueSphere assessments, and all internal procurement collaboration.

ProcurePath powers the **buyer-only panels** inside Engagement Rooms and is the primary interface for procurement teams.

This file defines all behaviours, UI surfaces, workflows, data interactions, and permission constraints for ProcurePath.

---

# 1. Purpose and Mission

ProcurePath exists to solve the central problems of modern procurement and sourcing:

1. Vendor management is scattered across Word docs, SharePoint folders, and email chains.  
2. RFX processes (RFP/RFQ/RFI) lack structured data and comparability.  
3. Evaluation and scoring are inconsistent and subjective.  
4. No single source of truth exists for risk, compliance, security, and legal reviews.  
5. Stakeholder alignment is slow and difficult.  
6. Buyers lack a clean way to collaborate with vendors structurally.

ProcurePath unifies ALL buyer-side intelligence, workflows, and evaluation logic into one modern interface.

---

# 2. Core Principles of ProcurePath

1. **Procurement-first design** — built for sourcing teams, not adapted from sales tools.  
2. **Vendor neutrality** — buyers must never receive biased vendor-facing perspectives.  
3. **Structured sourcing** — RFX, evaluations, approvals, and risks are formal data objects.  
4. **Deep comparability** — vendor responses must be analysable and benchmarkable.  
5. **Private-by-default** — buyer-only data NEVER leaks to vendors.  
6. **AI augmented** — scoring, risk detection, summarisation, and comparison are AI-assisted.  
7. **Shared transparency** — sanitized data may be selectively shared with vendors inside Engagement Rooms.  
8. **Domain grouping** — vendors must be categorised by capability domains for comparison.  
9. **Full lifecycle coverage** — initiation → evaluation → shortlist → decision → contract → renewal.

---

# 3. ProcurePath Data Model (Buyer Suite Domain)

ProcurePath relies on these key domain entities (defined formally in `domain_model.md`):

- VendorRecord  
- SourcingEvent  
- BuyerRiskProfile  
- ApprovalChain / ApprovalStep  
- Rfx, RfxSection, RfxQuestion  
- RfxResponse  
- RfxEvaluation  
- Buyer-mode ValueSphere  
- RFX-related Room linking

All buyer-side data carries **buyer-only visibility** unless explicitly shared.

---

# 4. ProcurePath Structure

ProcurePath includes the following major surface areas:

1. **Vendor Records**  
2. **Domains & Vendor Categorisation**  
3. **Sourcing Events**  
4. **RFX Creation & Issuance**  
5. **RFX Response Management**  
6. **Evaluation & Scoring**  
7. **Risk & Compliance**  
8. **Approval Workflows**  
9. **ValueSphere (Buyer Mode)**  
10. **Internal Stakeholder Management**  
11. **Engagement Room Buyer Panels**  
12. **Audit & Decision Record Generation**

The behaviour and UI of each surface is defined below.

---

# 5. Vendor Records (Buyer-Side Canonical Vendor Profile)

Vendor Records represent **buyer-owned** vendor profiles distinct from vendor-owned AgamaAccounts.

## 5.1 Vendor Record Fields
A VendorRecord includes:
- Vendor name  
- Domain category (e.g., observability, CRM, security, HRIS)  
- Link to AgamaAccount (optional), if vendor is also an Agama customer  
- Past performance  
- Contract history  
- Risk profile  
- Compliance status  
- Attachments (security docs, legal docs, references)  
- Metadata & tags  
- Internal notes (buyer-only visibility)

## 5.2 Vendor List UI
Must support filtering by:
- Domain  
- Risk  
- Performance  
- Ongoing sourcing events  
- Past contract value  
- Tags  

Each vendor card shows:
- Risk level  
- Domain category  
- Active sourcing events  
- Evaluation status across events  

---

# 6. Domains & Vendor Categorisation

ProcurePath includes a system for categorising vendors into capability domains.

## 6.1 Domain Taxonomy (Buyer Super User)
Buyer Super Users maintain:
- Domain list  
- Sub-domains  
- Evaluation templates per domain  
- Mapping vendors to domains  

## 6.2 Use Cases
- Organising vendors during sourcing  
- Benchmarking performance against peers  
- Domain-specific RFX templates  
- Domain-specific ValueSphere templates  

---

# 7. Sourcing Events (End-to-End Procurement Workflow)

The SourcingEvent object represents a single procurement initiative.

## 7.1 Lifecycle
- initiated  
- requirements_defined  
- rfx_draft  
- rfx_issued  
- responding  
- evaluation  
- shortlist  
- negotiation  
- decision  
- contract_signed  
- closed  

Transitions are captured in `AuditLog`.

## 7.2 Sourcing Event UI
Includes:
- Overview panel  
- Timeline  
- Vendor shortlist  
- RFX attachment  
- Stakeholder roles  
- Approvals  
- Evaluation dashboard  
- Risk dashboard  
- ValueSphere summary  

## 7.3 Vendor Shortlist
Each vendor appears with:
- RFX status  
- Evaluation status  
- Risk flags  
- Contract history  
- Summary of prior performance  

---

# 8. RFX Creation (Authoring, Drafting, Versioning)

RFX authoring is one of the most important ProcurePath capabilities.

## 8.1 RFX Builder
Buyer Super Users or Buyer Users with permissions can create:

- Topic area  
- Sections  
- Questions  
- Weights  
- Evaluation rubrics  
- Tags  
- Attachments (requirements docs, briefs)  

Supports:
- Draft mode  
- Collaboration with internal stakeholders  
- Internal comments  
- AI-assisted question suggestions  
- Auto-weighting recommendations  
- Versioning of RFX drafts  

## 8.2 RFX Status Flow
- Draft (editable)  
- Issued (locked from vendor perspective)  
- Responding  
- Evaluation  
- Closed  

AI may assist in:

- Drafting questions  
- Identifying missing areas  
- Suggesting weights  

AI must NOT use vendor-only or competitor responses during drafting.

---

# 9. RFX Issuance (Publishing to Vendors)

Upon issuance:

- RFX moves from `draft` to `issued`  
- Vendors are notified via Engagement Rooms  
- Vendors gain access to:
  - RFX questions  
  - Attachments  
  - Instructions  
  - Deadlines  

Buyers cannot modify questions post-issuance except through official "Amendment" flow:

- Amendment version created  
- Vendors notified  
- Questions track amendments per version  

---

# 10. RFX Response Management

Inside ProcurePath, for each vendor:

- Responses to each question  
- Attachments  
- AutoScore (AI suggestion)  
- ReviewScore (human review)  
- Internal buyer comments  
- Response metadata (submission time, completeness)  

Vendors cannot see:
- Scoring  
- Internal buyer comments  
- Other vendor responses  

---

# 11. Evaluation & Scoring

ProcurePath provides a structured evaluation framework.

## 11.1 Evaluation Surfaces
Evaluation surfaces include:

- Per-question scoring  
- Section scoring  
- AI risk detection  
- Rubric guidance  
- Peer comparison  
- Consistency warnings  

## 11.2 Scoring Rules
- Buyer defines weight per question and section  
- Weighted overall score computed automatically  
- AI may generate “draft scores” that buyers must confirm  
- Score overrides require justification  

## 11.3 Evaluation Dashboard
Shows:
- Vendor ranking (buyer-only)  
- Top strengths/weaknesses  
- Score breakdown  
- Risk overlays  
- ValueSphere integration (“value vs cost vs risk”)  

Scores remain strictly buyer-only.

---

# 12. Risk & Compliance

Buyers use risk data to inform decisions.

## 12.1 Risk Panels Show:
- Security evaluation  
- Compliance frameworks (SOC2, ISO, GDPR, HIPAA)  
- Data Protection Agreement status  
- Incident and breach history  
- Financial stability  
- News risk signals  
- Legal review status  

## 12.2 AI Augmentation
AI may:
- Flag suspicious or inconsistent responses  
- Summarise vendor risk posture  
- Highlight discrepancies between RFX responses and vendor docs  

AI must not:
- Expose risk analysis to vendors  
- Infer competitor risk  
- Share buyer-only reasoning with vendors  

---

# 13. Approval Workflows

ProcurePath includes full approval-chain logic.

## 13.1 ApprovalChain
Represents a multi-step approval process:
- Finance  
- Legal  
- InfoSec  
- Commercial  
- Executive sponsor  

Each approval step:
- Has assigned approver  
- Has a due date  
- Contains notes  
- Logs actions  

## 13.2 Approval Interaction
Approvers can:
- Approve  
- Reject  
- Delegate  
- Request changes  

All actions logged in `AuditLog`.

Vendors have zero visibility into approvals.

---

# 14. Buyer-Mode ValueSphere

ValueSphere operates in buyer context for:

- Evaluating vendors  
- Comparing scenarios  
- Modelling risk, cost, and value  
- Creating business justification documents  

## 14.1 Buyer VS Seller ValueSphere
Buyer-mode includes:
- Internal scoring alignment  
- Multi-vendor comparison  
- Weighting risk vs value vs cost  
- Procurement justification workflows  

Seller-mode includes:
- ROI/TCO storytelling  
- Seller-provided assumptions  

They remain separate unless explicitly published into shared ValueSphere inside Rooms.

## 14.2 Buyer-Mode Fields
- Weighted outcomes  
- Business drivers  
- Operational metrics  
- Risk-adjusted values  
- Cost scenarios  
- Internal-only notes  

---

# 15. Internal Stakeholder Management (Buyer-Side)

Sourcing Events define internal stakeholder roles:

- Decision maker  
- Champion  
- Technical reviewer  
- Legal reviewer  
- InfoSec reviewer  
- Finance approver  
- Executive sponsor  

ProcurePath must display:
- Who has completed evaluations  
- Who is blocking approvals  
- AI detection of non-engaged stakeholders  

Stakeholder identity is buyer-only and hidden from vendors.

---

# 16. Engagement Room Integration (Buyer Panels)

ProcurePath feeds buyer panels inside Engagement Rooms.

Buyer panels include:

1. Procurement Timeline  
2. Evaluation & Scoring  
3. Risk & Compliance  
4. Buyer ValueSphere  
5. Internal Notes (buyer-only)  
6. Vendor Comparison Context  

Buyer panels must NOT expose any buyer-only data to vendor or guest users.

Shared data is only the subset the buyer chooses to publish.

---

# 17. Collaboration Controls (Buyer → Shared)

Buyers can publish:

- Requirement summaries  
- Shared architecture inputs  
- Shared ValueSphere summaries  
- RFX clarifications  
- Timelines (shared portions only)  
- MAP items that are safe for vendors  

Buyers cannot publish:
- Scoring  
- Internal risk profiles  
- Approval status  
- Comparison matrices  
- Buyer ValueSphere full details  

---

# 18. Permissions in ProcurePath

ProcurePath is **strictly buyer-only**.

Permissions:

- Buyer Suite → full access  
- Vendor Suite → no access  
- Guest → no access  
- Dual Suite → access only when in buyer org context  

Buyer-only data must never appear in:

- Vendor panels  
- Vendor dashboards  
- Vendor AI outputs  
- Shared panels (unless explicitly published)

---

# 19. AI Rules for ProcurePath

AI may:
- Suggest RFX questions  
- Auto-score RFX answers with justification  
- Detect risks in vendor responses  
- Summarise evaluations  
- Provide comparison summaries  
- Draft procurement justification reports  

AI must NOT:
- Reveal buyer scoring to vendors  
- Reveal shortlist status  
- Reference vendor-only intelligence (which it cannot access anyway)  
- Mention other vendors in vendor-facing content  

AI must follow the strict isolation described in roles_permissions.md and MASTER SPEC.

---

# 20. UI Conventions for ProcurePath

Theme: buyer (green)

UI must include:

- Liquid glass panels  
- Three-column dashboard  
- Consistent iconography  
- Sticky left-side navigation  
- Context navigation inside events and RFX  
- Clean tables for evaluations  
- ValueSphere buyer-mode cards  
- Approval workflow visualisation  
- Risk panel with badges  
- Sourcing timeline view  

Responsiveness:
- Evaluations collapse to stacked lists  
- RFX questions collapse into accordions  
- Approval steps become swipeable cards  
- Risk panels compress into sections  

---

# 21. Codex Implementation Requirements

Codex MUST:

1. Enforce buyer-only visibility for all ProcurePath surfaces.  
2. Use `theme: buyer` for all ProcurePath screens.  
3. Implement all RFX and evaluation flows exactly as defined.  
4. Build multi-step approval flows.  
5. Use the domain model from `domain_model.md` verbatim.  
6. Never expose scoring or risk insights to vendor contexts.  
7. Support publish flows from buyer → shared Room spaces.  
8. Build internal stakeholder management UIs.  
9. Integrate with buyer-mode ValueSphere fully.  
10. Implement skeleton loaders for evaluations and tables.  
11. Honour accessibility rules (WCAG AA).  

---

# 22. Procurement Calendar Integration

ProcurePath must integrate with buyer calendars (Google/Microsoft) for:

- RFX deadlines
- Evaluation periods
- Approval due dates
- Contract signature milestones

Calendar sync rules:

- Calendar entries are buyer-only.
- Vendors never receive calendar invites via Agama.
- Reminders are sent via in-app notifications; email reminders may be added later.
- Calendar sync failures must not block procurement workflows.

# 23. Workload Balancing for Procurement Teams

ProcurePath must track evaluation workload across reviewers:

- Number of questions assigned
- Active sourcing events
- Overdue reviews
- Approvals pending

AI may:

- Recommend reassignment of work
- Detect reviewer overload
- Suggest balancing strategies

Buyer may override manually at all times.

---

# 24. Summary

ProcurePath is the buyer-side operational brain of Agama:

- Vendor Records  
- Domain categorisation  
- Sourcing Events  
- RFX authoring and issuance  
- Vendor scoring  
- Risk & compliance  
- Approval workflows  
- Buyer-only ValueSphere  
- Buyer panels in Rooms  
- Transparent, structured collaboration (when shared)  

This file defines everything necessary for Codex and engineers to build ProcurePath in full.

---

**End of procurepath.md**
