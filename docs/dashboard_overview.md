# dashboard_overview.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Dashboard Specification  
Last Updated: (update when committed)

This document defines the complete dashboard architecture for the Agama platform across Vendor Suite (RevenueForge), Buyer Suite (ProcurePath), Shared/Guest, and Dual-Suite contexts.

Dashboards are not decorative. They are **mission-critical control surfaces** that immediately reflect:

- What requires attention  
- What actions the user needs to take  
- How healthy accounts, vendors, sourcing events, rooms, and integrations are  
- What AI recommends next  
- What risks or opportunities require escalation  

Dashboards must be fast, predictable, themed correctly, and fully responsive.

---

# 1. Dashboard Philosophy

Dashboards are designed around these principles:

1. **One glance = full situational awareness**  
2. **Role-aware data surfaces** (Vendor, Buyer, Guest, Dual)  
3. **AI-enhanced insight** but not AI-dominated  
4. **Action-driven layout** (every widget must drive next steps)  
5. **Real-time refresh** or near-real-time polling  
6. **Theme clarity** (seller/buyer/shared)  
7. **Cognitive grouping** (clear columns for tasks, insights, and activity)  

Dashboards must feel like:

- A command centre  
- A personal assistant  
- A revenue/procurement cockpit  

Not a generic homepage.

---

# 2. Dashboard Types in Agama

Agama supports four dashboards:

1. **Vendor Dashboard** (Vendor Suite users)  
2. **Buyer Dashboard** (Buyer Suite users)  
3. **Guest Dashboard** (External room guests)  
4. **Dual-Suite Dashboard** (Users with both suites enabled)

Each dashboard uses its own theme:

- Vendor → Seller theme (blue/purple)  
- Buyer → Buyer theme (green)  
- Guest → Shared theme (orange)  
- Dual-Suite → Tabs that switch theme per context  

---

# 3. Vendor Dashboard (RevenueForge)

**Theme:** seller  
**Audience:** sales, presales, CS, renewals, vendor leadership  

## 3.1 Layout Structure (safe conceptual layout)

Vendor Dashboard must be composed of:

Column 1 — **Action Panels (highest priority)**  
Column 2 — **Operational Intelligence**  
Column 3 — **AI & Integrations**

No ASCII boxes are used; layout must follow the grid system.

---

## 3.2 Vendor Dashboard Widgets

Below are the required widgets in priority order.

### 1. My Accounts (Critical)
Shows accounts needing immediate attention.

Data sources:
- AgamaAccount  
- InteractionLog  
- HealthScore  
- RevenueForge intelligence  

Subsections:
- Accounts with declining health  
- Accounts with no interaction in X days  
- Accounts with upcoming renewal  
- Accounts in active Engagement Rooms  

Actions:
- “Open Account”  
- “Create Room”  
- “Review Timeline”  
- “Run Value Assessment”

Theme:
- Seller theme (blue/purple glass)

---

### 2. My Engagement Rooms
Shows rooms the vendor is part of.

Rows include:
- Room name  
- Buyer org (or guest contacts)  
- Stage (draft / active / closing)  
- Overdue MAP tasks  
- Unread messages  
- Shared vs vendor-only actions pending  

Actions:
- “Open Room”  
- “Publish Shared Item”  
- “Respond to RFX question”  

---

### 3. Tasks & MAP Items
Aggregated from:
- Vendor internal MAP  
- Shared MAP (Engagement Rooms)

Sections:
- Assigned to me  
- Due today  
- Blocked  
- Suggested next steps (AI)  

Tasks inherit theme of originating context but shown within seller dashboard container.

---

### 4. Interaction Timeline Summary
AI-generated summary of:
- Last 7 days of email + meetings  
- Gong calls  
- Calendar events  
- Major Room events  
- New stakeholders added  

Tags interactions with sentiment where available.

---

### 5. Stakeholder Heatmap Snapshot
Displays:
- Stakeholders at risk  
- Champions with low interaction  
- Blockers raised in RFX or evaluation  
- Missing roles (no economic buyer identified)

---

### 6. AI Suggestions & Risks (Vendor-Side)
AI suggestions must follow seller-safe boundaries (no buyer-only insights).

Examples:
- “You haven’t engaged the champion in 10 days.”  
- “AI suggests updating qualification: missing metrics.”  
- “This account’s engagement dropped by 40% week-over-week.”  
- “Competitor X detected in call transcripts.”  

---

### 7. Integration Health (Vendor Side)
Shows integration status for:
- CRM sync  
- Gong  
- Clari  
- Email/Calendar  

Each integration shows:
- Status (green/orange/red)  
- Last sync time  
- Errors / warnings  
- Actions (“Reconnect”, “Retry sync”, “View logs”)

---

# 4. Buyer Dashboard (ProcurePath)

**Theme:** buyer  
**Audience:** procurement, sourcing, commercial, legal, finance, security reviewers

## 4.1 Layout Structure

Column 1 — **Active Sourcing Events**  
Column 2 — **Evaluation Progress & Vendor Insights**  
Column 3 — **AI, Risks & Approvals**

---

## 4.2 Buyer Dashboard Widgets

### 1. Active Sourcing Events (Primary)
Displays:
- Event name  
- Phase (requirements / draft RFX / issued / evaluation / shortlist / negotiation / decision)  
- Days remaining to decision  
- Vendors per event  
- RFX status  

Actions:
- “Open Event”  
- “Issue RFX”  
- “Score vendor responses”  
- “Advance stage”

Theme:
- Buyer theme (green glass)

---

### 2. Vendor Evaluation Progress
Shows:
- Which vendors require scoring  
- Sections left incomplete  
- Missing evaluations from specific stakeholders  
- AI consistency checks (e.g., incomplete rubric coverage)

---

### 3. Risk & Compliance Highlights
Shows:
- Security flags  
- Financial risk flags  
- Compliance status (DPA, DPIA, SOC2, etc.)  
- External news risks  
- Incident flags  

Badge colours:
- Red = critical  
- Amber = moderate  
- Green = clear  

---

### 4. Approvals Requiring My Action
Pulled from:
- ApprovalChain  
- Procurement workflows  
- Sourcing events  
- Contract workflows  

Actions:
- “Approve”  
- “Request changes”  
- “Escalate”  

---

### 5. Buyer AI Insights
AI may recommend:
- “Vendor A’s responses contain inconsistent security answers.”  
- “Vendor C shows strong value alignment; review ValueSphere summary.”  
- “Upcoming contract renewal in 14 days without completed risk review.”  

NOTE: AI must NEVER expose vendor-only intel here.

---

### 6. Vendor Domain Overview (Procurement View)
Categorises vendors by domain:

- Observability  
- Security  
- CRM  
- Data Platform  
- etc.  

Shows:
- Count of vendors per domain  
- Domains requiring evaluation  
- Past performance indicators per vendor  

---

# 5. Guest Dashboard

**Theme:** shared  
**Audience:** external participants invited to Rooms  
**Purpose:**  
- Provide a minimal yet structured collaboration surface  
- Drive upsell to Buyer Suite or Vendor Suite  

## 5.1 Guest Dashboard Widgets

### 1. Rooms I Am In
Shows all Rooms the guest is participating in.

Includes:
- Room name  
- Vendor name  
- Key shared milestones  
- Unread messages  
- Pending shared tasks

---

### 2. My Shared Tasks
Tasks where:
- Assigned to guest  
- Or requiring guest action  
- Or waiting for guest’s input in shared sections

---

### 3. Recent Room Activity (Shared Only)
Shows:
- New shared documents  
- Shared MAP updates  
- New shared ValueSphere items  
- RFX questions (if applicable)

---

### 4. Upsell Surfaces
Displayed prominently:

- “Unlock Procurement Workspace with Agama Buyer Suite”  
- “Centralise vendor evaluations”  
- “Gain access to approvals, scoring, and risk”  

If the guest appears to be a vendor:
- “Unlock Revenue Workspace with Agama Vendor Suite”  
- “Centralise accounts, qualification, architecture, and MAP”

---

# 6. Dual-Suite Dashboard

**Theme Behaviour:**  
User chooses between **Vendor** and **Buyer** tabs.  
Theme changes dynamically.

## 6.1 Dashboard Switching

Tabs:
- Vendor Workspace  
- Procurement Workspace  

Switching must:
- Update theme token  
- Reconfigure navigation  
- Load correct dashboard widgets  

---

# 7. Cross-Dashboard Behaviour Rules

## 7.1 Filtering
All dashboards must support filtering by:

- Date range  
- Room  
- Account / Vendor  
- Domain (buyer side)  
- Signal type (vendor side)  

Filters persist across sessions.

## 7.2 Search
All dashboards must include global search (cross-entity).

## 7.3 Real-Time Updates
Dashboards should update automatically when:

- New Room messages arrive  
- MAP task changes  
- RFX questions/responses update  
- Evaluations change  
- Integrations sync  
- AI updates produce new insights  

Real-time updates use WebSockets or SSE depending on the collaboration engine.

### 7.4 Empty-State and Fallback Behaviour

Dashboards must provide explicit empty-state designs to support users who have not yet populated data.

#### Vendor Dashboard Empty States
- No accounts: Show a card prompting the user to connect CRM or create an Account manually.
- No rooms: Show a card prompting the user to create an Engagement Room.
- No tasks: Show an empty task state encouraging shared MAP participation.
- No integration data: Show integration setup prompts.

#### Buyer Dashboard Empty States
- No sourcing events: Show a card prompting creation of a new sourcing event.
- No vendors: Prompt adding vendor records or importing them via ERP.
- No evaluations: Show a card explaining upcoming RFX steps.
- No approvals: Show “No approvals pending.”

#### Guest Dashboard Empty States
- No rooms: Display a gentle onboarding card, not a hard empty state.
- No tasks: Display “No shared tasks assigned to you yet.”

Empty states must:
- Use theme-appropriate styling.
- Include actions that direct the user to next steps.
- Avoid technical jargon.


---

# 8. Dashboard Theming Requirements

- Vendor Dashboard = seller theme only  
- Buyer Dashboard = buyer theme only  
- Guest Dashboard = shared theme only  
- Dual Dashboard  
  - Vendor tab uses seller theme  
  - Buyer tab uses buyer theme  

No mixing themes within the same dashboard.

---

# 9. Component Requirements for Dashboards

Every widget must be built using:

- Liquid glass card pattern  
- Header section (title + metadata)  
- Body section (list/table/summary)  
- Footer optional (actions or summaries)  
- Theme-consistent shadows, radius, and iconography  

Cards must use the 8px spacing grid:

- Padding: 24px  
- Spacing between cards: 24–32px  
- Heading spacing: 16px  
- Table row spacing: 10–14px  

---

# 10. AI Surfaces on Dashboards

AI surfaces must be:

- Permission-safe (no buyer-only intel in vendor dashboard; no vendor-only intel in buyer dashboard)  
- Clearly marked as AI-generated  
- Editable / overrideable by humans  
- Summarised (AI should not dump raw logs)  

---

# 11. Responsiveness (Dashboard)

On smaller viewports:

- Columns collapse into vertical stacking  
- Filters become dropdowns  
- Room activity feeds become compact lists  
- Tables become stacked cards with metadata rows  
- AI suggestion cards move to bottom position  

---

# 12. Codex Implementation Rules

Codex MUST:

1. Use theme tokens correctly per dashboard  
2. Build widgets as Liquid Glass cards  
3. Follow column layout described above  
4. Use skeleton loaders when loading data  
5. Respect role permissions:  
   - Vendor-only widgets never appear in Buyer dashboards  
   - Buyer-only widgets never appear in Vendor dashboards  
   - Shared widgets only appear when appropriate  
6. Implement real-time update support  
7. Use accessibility-compliant colours and contrasts  
8. Ensure dashboard switching (dual mode) updates theme + navigation instantly  

---

# 13. Summary

This file defines:

- All Dashboard types  
- Widget structures  
- Role-based rules  
- AI usage  
- Layout standards  
- Theme systems  
- Panel composition  
- Integration of Room + Suite data  
- Real-time update expectations  
- Codex-specific UI constraints  

Dashboards must clearly separate vendor intelligence, buyer analytics, and shared collaboration, while maintaining the visual elegance and enterprise polish expected of the Agama platform.

---

**End of dashboard_overview.md**
