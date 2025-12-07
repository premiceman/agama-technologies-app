# ui_conventions.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative UI/UX & Styling Specification  
Last Updated: (update before commit)

This document defines the UI conventions, theme system, styling rules, UX patterns, and component specifications for the Agama platform. It applies to all surface areas including RevenueForge, ProcurePath, Engagement Rooms, ValueSphere, Dashboards, and global navigation.

This file is the UI foundation for Codex-generated frontend code. All future UI work MUST match the patterns defined here.

---

# 1. Design Philosophy

Agama’s design system is built on these principles:

1. Simplicity and clarity  
2. Structural separation between personas (Vendor, Buyer, Shared)  
3. Liquid Glass aesthetic  
4. Enterprise-grade elegance (inspired by Apple/Human Interface Guidelines, Linear, Notion, Stripe)  
5. Predictable layout structures  
6. Minimal cognitive load  
7. Clear visual hierarchy  
8. Consistent spacing and alignment  
9. Permission-safe visual cues (never confuse vendor/buyer/shared)  

---

# 2. Theme System (Seller / Buyer / Shared)

Every UI component must declare one theme token:

- theme: seller  
- theme: buyer  
- theme: shared  

This determines colours, shadows, gradients, and glass effects.

## 2.1 Seller Theme
Used in:
- RevenueForge
- Vendor-only panels in Engagement Rooms
- Seller-mode ValueSphere

Colours:
- Primary: #5A4BFF
- Secondary: #A08CFF
- Accent: #C5B8FF

Liquid Glass:
- Blur: 18–22px
- Gradient overlay: rgba(90,75,255,0.22) to rgba(90,75,255,0.08)

Shadows:
- Glow: rgba(90,75,255,0.45)
- Drop shadow: rgba(17,0,80,0.25) 0px 4px 12px

## 2.2 Buyer Theme
Used in:
- ProcurePath
- Buyer-only panels in Engagement Rooms
- Buyer-mode ValueSphere
- RFX authoring and evaluation

Colours:
- Primary: #28A745
- Secondary: #7ACB94
- Accent: #C7ECD3

Liquid Glass:
- Blur: 18–22px
- Gradient: rgba(40,167,69,0.22) to rgba(40,167,69,0.08)

Shadows:
- Glow: rgba(40,167,69,0.45)
- Drop shadow: rgba(0,50,0,0.25) 0px 4px 12px

## 2.3 Shared Theme
Used in:
- Shared MAP
- Shared Architecture
- Shared Documents
- Shared Messages
- Shared ValueSphere
- Shared RFX answering

Colours:
- Primary: #FF7A00
- Secondary: #FFB45A
- Accent: #FFD8A8

Liquid Glass:
- Blur: 18–22px
- Gradient: rgba(255,122,0,0.22) to rgba(255,122,0,0.08)

Shadows:
- Glow: rgba(255,122,0,0.45)
- Drop shadow: rgba(80,40,0,0.25) 0px 4px 12px

---

# 3. Layout Conventions

Agama layouts follow a strict hierarchy.

## 3.1 Page Structure (safe representation)

Top-level layout components must appear in this order:

1. Primary Navigation (left vertical rail)
2. Context Navigation (top or right)
3. Page Content (central panels/cards)
4. Optional Context Drawer (right side)
5. Footer or status bar (where needed)

No ASCII art boxes are used in code; ALL components should be represented as plain structure.

## 3.2 Primary Navigation
Contains:
- Dashboard
- RevenueForge (if vendor suite)
- ProcurePath (if buyer suite)
- Rooms
- ValueSphere
- Admin/Org settings

Behaviour:
- Collapsible  
- Icons + labels  
- Clear highlight for selected page (theme-based)

## 3.3 Context Navigation
Appears differently per surface:
- Account-level context in RevenueForge
- Sourcing Event context in ProcurePath
- Engagement Room context
- RFX context
- ValueSphere context
- Dashboard filters

---

# 4. Component System

## 4.1 Cards
Properties:
- Rounded corners: 18px
- Blur: 18px
- Background opacity: 0.35–0.55
- Themed glass gradient
- Header and body separation with spacing, not borders

Usage:
- High-level summaries
- Info panels
- Room panels
- Dashboard widgets

## 4.2 Tables
Rules:
- Sticky header
- Light zebra striping
- Hover state per row
- Left-aligned text
- No heavy borders; use soft separators
- Column resizing allowed
- Pagination or infinite scroll where needed

## 4.3 Buttons
Styles:
- Primary (solid)
- Secondary (outline)
- Tertiary (text)
- Destructive (red)

Theme inheritance:
- Seller → blue-purple buttons
- Buyer → green buttons
- Shared → orange buttons

Border radius: 12px  
Min height: 40px

## 4.4 Inputs
- Rounded 12px
- Theme-coloured focus ring
- Label always visible (no floating labels)
- Helper text optional
- Soft shadows

## 4.5 Modals
- Liquid glass theme-specific overlay
- Dimmed background
- Header + description
- Actions placed at bottom (primary left, secondary right)
- ESC closes (if safe)

## 4.6 Tabs
- Theme-based active colour
- Underline indicator or filled-select indicator
- No mixed-theme tabs

---

# 5. Typography

Fonts:
- Inter (primary)
- System UI fallbacks

Sizing:
- H1: 32–36px
- H2: 26–30px
- H3: 22–24px
- Body: 15–17px
- Secondary: 13–14px
- Caption: 11–12px

Weights:
- Regular 400
- Medium 500
- Semibold 600
- Bold 700

Line spacing:
- 1.35–1.5 for body
- 1.1–1.25 for headings

---

# 6. Iconography

Icon library:
- Lucide
- HeroIcons
- Phosphor Icons

Rules:
- Size: 20–24px grid
- Theme-coloured active states
- Neutral grey for inactive
- Do not mix icon sets in the same panel

---

# 7. Interaction Behaviour

## 7.1 Hover States
All clickable elements must:
- Slightly elevate (scale 1.015)
- Increase shadow subtly
- Increase opacity 2–5%

## 7.2 Focus States
- Must pass WCAG AA
- Theme-based outline (2px)
- Clear offset from element

## 7.3 Loading States
Use skeleton loaders for:
- Lists
- Tables
- Panels
- Documents

Avoid spinners except for very short actions.

---

# 8. Engagement Rooms UI Conventions

Engagement Rooms follow a consistent layout.

## 8.1 Tabs
Vendor User sees:
- Vendor Qualification
- Internal MAP
- Competitive Strategy
- Architecture (vendor view)
- Vendor ValueSphere
- Shared tabs

Buyer User sees:
- Procurement Timeline
- Evaluation & Scoring
- Stakeholders
- Risk & Compliance
- Buyer ValueSphere
- Shared tabs

Guest sees:
- Shared tabs only

Tabs must always include theme-based visual anchors.

## 8.2 Shared Panels (always shared theme)
These include:
- Shared Overview
- Messages
- Shared MAP
- Shared Documents
- Shared Architecture
- Shared ValueSphere
- RFX answering panel

## 8.3 Publishing Controls
Vendor-side “Promote to Shared” controls appear on:
- Qualification fields
- Architecture drafts
- MAP items

Buyer-side “Publish Summary” controls appear on:
- Evaluation summaries
- Risk summaries
- ValueSphere overviews

Published items appear in shared panels with metadata indicating:
- Who published  
- When  
- Version (if applicable)

---

# 9. Dashboard Conventions

Dashboards use a three-column structure (illustrated conceptually without ASCII art):

Column 1:
- High-priority actionable items  
- Tasks, overdue or upcoming  
- Key health metrics  

Column 2:
- Activity streams  
- Engagement summaries  
- Accounts or Vendors requiring attention  

Column 3:
- AI suggestions  
- Integration health  
- Notifications  

## 9.1 Animation & Motion Guidelines

Animations must be subtle and purpose-driven.

Rules:
- Duration: 120–180ms
- Easing: cubic-bezier curves, no linear motion
- Elements that may animate:
  - Card hover elevation
  - Tab underline transitions
  - Modal fade-in/out
  - Button hover/press states
- Elements that must NOT animate:
  - Text content
  - Form inputs
  - Critical actions (submission, scoring, approvals)

Reduced motion mode must disable all non-essential animations.

## 9.2 Error UX Rules

All error states must be:

- Clear, human-readable
- Theme-consistent
- Non-technical unless necessary

Vendor surfaces → seller theme  
Buyer surfaces → buyer theme  
Shared surfaces → shared theme

Error components must include:
- Title
- Short explanation
- Optional retry button
- Optional “view details” expander
- Link to documentation (future)

Critical errors must be logged with correlationId for observability.



---

# 10. Accessibility & Contrast

Rules:
- WCAG AA minimum everywhere
- Text contrast >= 4.5:1
- Icon contrast >= 3:1
- Liquid glass panels: use darker text to avoid washed-out colours
- Never use pure white text on tinted glass backgrounds

---

# 11. Responsiveness

Supported breakpoints:
- Mobile portrait
- Mobile landscape
- Tablet
- Desktop
- Large desktop

Behaviours:
- Primary nav collapses to bottom nav on mobile
- Context drawer becomes modal
- Tables collapse into stacked lists
- Multi-column layouts compress into single column

---

# 12. Codex Implementation Rules

Codex must:

1. Always set a theme token (seller/buyer/shared)
2. Apply Liquid Glass theme containers
3. Use the 8px spacing grid
4. Use consistent card/panel structure
5. Use skeleton loaders for loading states
6. Respect visibility roles (vendor, buyer, guest)
7. Never mix themes incorrectly
8. Follow typography scale exactly
9. Use safe icons only
10. Implement consistent hover/focus/active states
11. Ensure all UI states are accessible
12. Maintain room role isolation in Engagement Rooms

---

# 13. Summary

This document defines:

- Agama’s theme system  
- UI/UX patterns  
- Liquid glass implementation rules  
- Component standards  
- Interaction behaviours  
- Engagement Room UI structures  
- Dashboard layouts  
- Accessibility rules  
- Codex implementation constraints  

All future UI must reference this document before code is written.

---

**End of ui_conventions.md**
