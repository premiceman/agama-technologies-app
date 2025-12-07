# revenueforge.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for Vendor Intelligence (Vendor Suite)  
Last Updated: (update before commit)

RevenueForge is the **vendor-side operational intelligence layer** of Agama. It consolidates CRM, communications, intelligence signals, qualification, competitive strategy, architecture design, and account team collaboration into one unified workspace.

RevenueForge powers the **vendor-only panels** inside Engagement Rooms and is the central system-of-record for vendor-side Behaviours.

This file defines all data structures, workflows, UI surfaces, and AI constraints for RevenueForge.

---

# 1. Purpose and Mission

RevenueForge exists to solve the core pain points in modern revenue organisations:

1. Intelligence is scattered across CRM, emails, calls, and separate tools.  
2. Qualification and discovery are inconsistent across reps.  
3. Architecture and technical solution work is poorly organised.  
4. Competitive intel is tribal knowledge.  
5. MAP execution is inconsistent and often untracked.  
6. Collaboration with buyers lacks structure and transparency.  

RevenueForge unifies all of this into a coherent, structured system built for:

- Sales  
- Presales  
- Solutions Architecture  
- Customer Success  
- Renewals/Expansion  
- Sales Leadership  

---

# 2. Core Principles of RevenueForge

1. **Account-centric** — everything revolves around the AgamaAccount object.  
2. **Integrated** — CRM, email, calendar, Gong, Clari signals aggregate automatically.  
3. **Structured** — qualification, architecture, MAP all use formal models.  
4. **Permission-safe** — vendor-only vs shared data control is strict.  
5. **AI-augmented** — AI enhances every workflow without leaking restricted data.  
6. **Publish-ready** — vendor can selectively publish items to Engagement Rooms.  
7. **Deal-aligned** — RevenueForge powers seller-facing panels in Rooms.  

---

# 3. RevenueForge Data Model (Vendor Suite Domain)

RevenueForge relies primarily on the following domain entities (detailed in domain_model.md):

- AgamaAccount  
- Stakeholder  
- InteractionLog  
- Qualification  
- CompetitiveIntel  
- ArchitectureDesign  
- InternalMAP (vendor-only MAP)  
- Revenue Signals: Gong, Clari, email/calendar  
- Seller-mode ValueSphere  

Every entity under RevenueForge inherits **vendor-only by default**, unless explicitly published into a Room as shared content.

---

# 4. RevenueForge Structure

The RevenueForge workspace contains the following page-level surfaces:

1. **Accounts List**  
2. **Account 360**  
3. **Stakeholders**  
4. **Interaction Timeline**  
5. **Qualification & Discovery**  
6. **Solution & Architecture**  
7. **Competitive Landscape**  
8. **Internal Mutual Action Plan (MAP)**  
9. **ValueSphere (Seller Mode)**  
10. **Engagement Room Linking / Room Creation**  

Each surface has its own data rules, behaviours, and UI conventions defined below.

---

# 5. Accounts List

This is the primary “home” surface of RevenueForge.

## 5.1 Data Shown Per Account
Each account card must include:

- Account name  
- CRM stage (if mapped)  
- Health score  
- Last interaction timestamp  
- Open MAP items (internal or shared)  
- Room status (if a Room has already been created)  
- AI risk/insight badges  
- Assigned internal team  

## 5.2 Sorting & Filtering
Users must be able to filter by:

- Owner  
- Stage  
- Health score thresholds  
- CRM fields  
- Integration signals (e.g. Gong engagement level)  

## 5.3 Actions
- Open Account  
- Create Engagement Room  
- Add Stakeholder  
- Add team members  
- Run ValueSphere  
- Refresh CRM/Gong/Clari sync  

---

# 6. Account 360 (The Core Vendor Intelligence Page)

This is the most important view inside RevenueForge.  
Every vendor workflow converges here.

## 6.1 Components

### 1. Account Header
- Account name  
- CRM metadata  
- Tags  
- Agama health score  
- Owner  
- “Create Room” button  
- “Publish to Room” quick actions  

### 2. Integrations Summary
Shows aggregated signals from:

- CRM pipeline (owner, stage, amount, next steps)  
- Gong activity  
- Clari risk indicators  
- Email engagement  
- Calendar meetings  
- Internal ValueSphere status  
- Room status (if exists)

### 3. Stakeholder Summary
- Key personas  
- Influence map  
- Sentiment  
- Coverage gaps  
- Last contact  

### 4. Qualification Summary
- Status per framework field  
- Confidence indicators  
- Missing elements flagged by AI  

### 5. Architecture Summary
- Latest architecture draft (thumbnail preview)  
- Unpublished changes indicator  
- Shared vs vendor-only statuses  

### 6. Competitive Summary
- Known competitors  
- AI-inferred competitors from call transcripts  
- Strengths/weaknesses  

### 7. MAP Snapshot
- Internal vendor-only MAP for this account  
- Tasks due today  
- Dependencies  
- Blockers  
- Items ready to publish  

### 8. ValueSphere Snapshot
- Seller-mode assessment progress  
- Key metrics  
- Shared/not shared state  

---

# 7. Stakeholder Management

## 7.1 Stakeholder List
Displays all stakeholders associated with the account.

Columns:
- Name  
- Role  
- Influence  
- Sentiment  
- Relationship strength  
- Last interaction  
- Tags  

## 7.2 Stakeholder Detail Panel
- Full profile  
- Interaction history  
- Notes (vendor-only)  
- AI sentiment trends  
- Coverage suggestions  
- Link to add into Room (if needed)  

---

# 8. Interaction Timeline

Unified view of all interactions with the customer account from all integrated sources.

## 8.1 Event Types
- Email  
- Meeting  
- Gong call  
- Call transcript segments  
- Calendar events  
- Internal notes  
- Room actions (shared events only)  
- Integration events  

## 8.2 AI Summaries
AI generates:
- “What changed this week?”  
- “Interaction anomalies”  
- “Sentiment highlights”  

AI must never use buyer-only data to generate vendor-facing summaries.

---

# 9. Qualification & Discovery (Vendor-Only)

## 9.1 Structured Frameworks
Vendor Super Users define templates for:

- MEDDIC  
- BANT  
- Custom frameworks per vertical  

## 9.2 Qualification Fields
Each field contains:
- Name  
- Description  
- Confidence  
- Vendor-only notes  
- Optional “publishable summary” for shared visibility  

## 9.3 AI Assistance
AI can:
- Suggest missing qualification fields  
- Identify inconsistencies  
- Recommend discovery questions  
- Surface risk areas  

AI cannot:
- Pull in buyer-only RFX scoring or evaluation  
- Leak internal buyer information  

---

# 10. Solution & Architecture (Vendor-Only with Publish Controls)

## 10.1 ArchitectureDesign Object
Contains:
- Diagram JSON  
- Assumptions  
- Dependencies  
- Risks  
- Version  
- Visibility: vendor_only or shared  

## 10.2 Draft vs Published Versions
Vendor-only drafts:  
- Fully private  
- Unlimited versions  

Shared published versions:  
- Visible to buyers & guests  
- Add transparency badges  
- Support version history  

## 10.3 AI Assistance
AI can:
- Suggest architecture shapes  
- Highlight missing elements  
- Extract architecture requirements from transcripts  
- Summarise architecture in human-readable bullet points  

AI must not:
- Leak internal notes into shared outputs  

---

# 11. Competitive Landscape

## 11.1 CompetitiveIntel Object
Stores:
- Competitor name  
- Strengths  
- Weaknesses  
- Watchouts  
- Landmine responses  
- Win/loss intel  

## 11.2 AI Assistance
AI can:
- Summarise competitive trends  
- Detect competitor mentions in calls  
- Recommend counter-positioning strategies  

AI cannot:
- Reveal which vendors are shortlisted in buyer evaluations  

---

# 12. Internal Mutual Action Plan (MAP)

Vendor-only MAP is distinct from the shared Room MAP.

## 12.1 Internal MAP Elements
- Tasks  
- Milestones  
- Dependencies  
- Blockers  
- Owner  
- Due date  
- Internal notes  

## 12.2 Publish to Shared MAP
Vendor user chooses which tasks can be shared in Engagement Rooms.

Requirements:
- Preserve vendor-only data internally  
- Create shared MAP entry with sanitized description  

---

# 13. ValueSphere (Seller Mode)

Seller-mode ValueSphere is the vendor’s view for articulating value.

## 13.1 Value Assessment Structure
- Input fields  
- Business metrics  
- ROI/TCO estimates  
- Qualitative drivers  
- Assumptions  
- Scenarios  

## 13.2 Sharing Logic
- Vendor can create and maintain internal assessments  
- Vendor can share a sanitized version into the Room  
- Shared ValueSphere never exposes internal assumptions flagged as vendor_only  

---

# 14. Engagement Room Integration

RevenueForge is the creator of vendor-origin Engagement Rooms.

## 14.1 Create Room Flow
From Account 360:
- Select buyer stakeholders or guests  
- Configure Room name  
- Select templates or initial shared assets  
- Room initializes vendor-only + shared tabs  

## 14.2 Vendor Panel Binding
Inside a Room:
- Vendor Qualification → sourced from RevenueForge  
- Vendor Architecture → sourced from RevenueForge  
- Internal MAP → sourced from RevenueForge  
- Competitive → sourced from RevenueForge  
- Seller ValueSphere → sourced from RevenueForge  

All data flows one-directionally:
- RevenueForge → Engagement Room vendor panels  
- Publish actions → Engagement Room shared panels  

---

# 15. Permissions in RevenueForge

RevenueForge is **strictly vendor-only**.

Access Control:
- Vendor Suite → full access  
- Buyer Suite → no access  
- Guest → no access  
- Dual Suite → vendor-side access only when in vendor org context  

Vendor-only data must never appear in:
- Shared panels (unless explicitly published)  
- Buyer-only panels  
- Buyer dashboards  
- AI summaries for buyers  

---

# 16. AI Rules for RevenueForge

AI may:
- Analyse vendor-only data for vendor-only output  
- Summarise seller qualification  
- Surface risks  
- Detect competitor mentions  
- Draft architecture text  
- Suggest MAP tasks  
- Write seller-facing emails or messages  

AI may NOT:
- Use buyer-only data for vendor outputs  
- Reference buyer RFX scores or internal evaluations  
- Reveal buyer risk or procurement decisions  
- Infer competitors from buyer evaluation data  

These AI boundaries are absolute.

---

# 17. UI Conventions for RevenueForge

Theme: seller (blue/purple)

Elements:
- Liquid glass panels  
- Clear card layout  
- Three-column Account 360 structure  
- Sticky left tab bar for vendor-only sections  
- Quick actions always visible in top-right  

Responsiveness:
- Architecture canvas collapses into scrollable panes  
- Tables collapse into stacked card views  
- Maps and diagrams scale down fluidly  

---

# 18. Codex Implementation Requirements

Codex MUST:

1. Respect theme tokens (`seller` only).  
2. Implement ALL surfaces above verbatim.  
3. Enforce all visibility constraints.  
4. Use the domain model exactly as defined in domain_model.md.  
5. Use skeleton loaders for Account 360.  
6. Provide action-driven UIs everywhere (not informational only).  
7. Never leak buyer-only data.  
8. Build Room creation flows directly from Account 360.  
9. Ensure architecture publishing uses versioning.  
10. Follow all UI conventions from ui_conventions.md.

---

# 19. Account Team Roles

Every Account in RevenueForge must define roles for participants:

- Account Executive
- Sales Engineer
- Customer Success Manager
- Technical Architect
- Executive Sponsor
- Renewal Manager

Each role must have:

- userId
- responsibilities
- capacity indicators
- lastEngagedAt

These roles appear in Account 360 and can be referenced in Engagement Rooms during vendor preparation.

# 20. Engagement Readiness Score

RevenueForge must compute a readiness score (0–100) reflecting whether the vendor is prepared to engage the buyer.

Factors include:

- Qualification completeness
- Stakeholder coverage
- Timeline recency
- Competitive intel completeness
- Architecture draft status
- Internal MAP completeness

AI may calculate a score and provide explanations, but cannot share readiness insights with buyers.

---

# 21. Summary

RevenueForge is:

- The vendor-side data brain  
- The vendor-side workflow engine  
- The vendor-side collaboration starter  
- The vendor-owned source of truth for vendor-only insights  

It connects all vendor-side intelligence and pushes structured, cleanly permissioned data into Engagement Rooms through explicit publish actions.

All engineering, product, and Codex development MUST follow this file.

---

**End of revenueforge.md**
