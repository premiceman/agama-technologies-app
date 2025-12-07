
## 5.1 draft
- Private to seller or buyer  
- Editable  
- AI-assisted modelling allowed  
- Not visible to Room participants unless shared  

## 5.2 shared
- Published into a Room’s shared panel  
- Vendor, buyer, and guests can view  
- Only sanitized fields shown  
- Vendor-only or buyer-only fields never show here  

## 5.3 agreed
- Vendor and buyer have aligned on shared assumptions  
- Scenarios can still be refined  
- “Locked” items may be individually flagged  

## 5.4 locked
- Assessment is frozen for:
  - Commercial negotiation  
  - Decision justification  
  - Approval workflows  

Locked assessments cannot be modified except by duplicating.

---

# 6. Seller-Mode ValueSphere (Vendor Perspective)

Seller-mode is a **storytelling + modelling** tool.

## 6.1 Seller Workflow

1. Vendor selects template  
2. Enters value hypotheses  
3. Identifies value drivers  
4. Enters qualitative discovery notes  
5. Enters numeric metrics (cost savings, efficiency, revenue uplift)  
6. Generates scenarios  
7. AI generates:
   - Draft narratives  
   - ROI/TCO breakdown  
   - Key impact sections  
8. Vendor publishes sanitized summary into shared mode (optional)

## 6.2 Seller-Only Fields
Not visible to buyers:

- Internal assumptions  
- Discovery notes  
- Competitive comparisons  
- Internal risks  
- Anything marked vendor_only  

These fields must never enter transcripts of shared-mode content.

## 6.3 Publishing
Vendor may publish:

- “Executive summary”  
- “Scenario summaries”  
- “Shared assumptions”  

Vendor may NEVER publish:

- Internal assumptions  
- Competitive intel  
- Internal risk modifiers  
- Discount-related metrics  

---

# 7. Buyer-Mode ValueSphere (Buyer Perspective)

Buyer-mode is used for **evaluation and justification**.

## 7.1 Buyer Workflow

1. Buyer selects buyer template  
2. Inputs vendor evaluation values  
3. Adjusts weights  
4. Creates scenarios  
5. Runs multi-vendor comparisons  
6. Generates internal justification reports  
7. Optionally publishes sanitized shared summary  

## 7.2 Buyer-Only Fields
Not visible to vendors:

- Internal vendor comparison  
- Scoring  
- Weighting  
- Internal assumptions  
- Risk adjustments  
- Cost breakdowns not shared  
- Executive justification notes  

These fields remain buyer_only permanently.

## 7.3 Comparison Engine
Buyer-mode ValueSphere must support:

- Weighted scoring matrix  
- Normalised scores  
- Scenario comparisons ("best", "likely", "conservative")  
- Multi-vendor heatmaps  
- Risk overlays  

These NEVER appear in vendor views.

---

# 8. Shared-Mode ValueSphere (Collaboration Surface)

The shared value model appears in Engagement Rooms.

This is the **neutral, non-sensitive** view of value.

## 8.1 Shared Content Includes:
- Value drivers  
- Agreed assumptions  
- Shared metrics (high-level)  
- Summaries  
- Scenario overviews  
- Timeline of value impact  
- Visualisation charts  

## 8.2 Shared Content Excludes:
- Internal vendor assumptions  
- Internal buyer assumptions  
- Weightings  
- Internal scoring  
- Cost models  
- Competitive intel  
- Shortlist or comparison results  

---

# 9. Scenarios

Scenarios help both sides understand projected outcomes.

## 9.1 Types of Scenarios
- Baseline  
- Expected / Most probable  
- Conservative  
- Aggressive  
- Custom scenario  

## 9.2 Scenario Inputs
Examples:
- Cost savings  
- Efficiency gains  
- Forecasted revenue uplift  
- Automation percentages  
- FTE reduction  
- Licence cost changes  
- Operating cost changes  

## 9.3 Scenario Outputs
- ROI  
- TCO  
- Payback period  
- Time-to-value  
- Key metrics dashboards  

## 9.4 AI Assisted Scenarios
AI may:
- Suggest scenario sets  
- Identify unrealistic assumptions  
- Recommend benchmarks  
- Detect inconsistencies in vendor answers  

AI must respect visibility restrictions.

---

# 10. AI in ValueSphere

AI plays several roles:

## 10.1 Seller-Side AI
Allowed to:
- Draft narrative (vendor perspective)  
- Suggest metrics  
- Highlight assumptions  
- Summarise discovery insights  
- Identify value gaps  

Forbidden to:
- Use buyer-only data  
- Compare vendors  
- Reveal competitor scoring  

## 10.2 Buyer-Side AI
Allowed to:
- Compare vendors  
- Highlight risk/value contradictions  
- Recommend weightings  
- Summarise vendor responses  
- Generate justification narratives  

Forbidden to:
- Use vendor-only field content  
- Reveal competitor scores in shared mode  
- Leak internal assumptions  

## 10.3 Shared-Mode AI
Allowed to:
- Summarise shared material  
- Provide general insights  
- Assist collaborative writing  

Forbidden to:
- Inject private vendor/buyer context into shared outputs  
- Infer internal decisions (like shortlist status)  

---

# 11. Room Integration

ValueSphere integrates deeply with Engagement Rooms.

## 11.1 Vendor-Only Panel
Contains:
- Seller-mode ValueSphere  
- “Publish to Shared” controls  
- Version history  

## 11.2 Buyer-Only Panel
Contains:
- Buyer-mode ValueSphere  
- Vendor comparison context  
- Internal-only evaluations  

## 11.3 Shared Panel
Contains:
- Shared-mode assessment  
- Summary  
- Agreed scenarios  
- Charts  

Changes made in vendor-only or buyer-only panels never sync to shared mode unless explicitly published.

---

# 12. Publishing Model (ValueSphere-Specific)

Publishing is strict:

## 12.1 Vendor → Shared
Vendor may publish:
- Scenario summaries  
- Value driver bullet points  
- High-level metrics  
- Agreed assumptions  
- ROI ranges (if sanitized)  

Vendor may NOT publish:
- Competitive intel  
- Exact cost breakdowns  
- Internal discounting models  
- Seller-only risk notes  

## 12.2 Buyer → Shared
Buyer may publish:
- Requirements-driven value rationale  
- Neutral summaries  
- Shared drivers  

Buyer may NOT publish:
- Scoring  
- Shortlist position  
- Comparison matrices  
- Internal risk adjustments  

---

# 13. UI Conventions (ValueSphere)

Theme usage:
- Seller mode: seller theme  
- Buyer mode: buyer theme  
- Shared mode: shared theme  

## 13.1 Layout
Sections appear as expandable cards:
- Section title  
- Weighted indicator  
- Percent contribution  
- Question lists  

## 13.2 Question UI Types
- Text area  
- Numeric input  
- Slider  
- Select dropdown  
- Multi-select  
- Toggle (boolean)  

## 13.3 Scenario Modelling UI
- Tabbed interface: Baseline / Expected / Conservative / Aggressive  
- Graphs and charts  
- Numeric inputs  
- AI suggestion button  

---

# 14. Codex Implementation Requirements

Codex MUST:

1. Implement seller-mode, buyer-mode, and shared-mode views separately.  
2. Apply correct theme tokens consistently.  
3. Use the domain structures from `domain_model.md`.  
4. Enforce visibility rules strictly.  
5. Build scenario modelling capabilities.  
6. Implement template editor for Super Users.  
7. Ensure ValueAssessments follow the state machine precisely.  
8. Implement full publishing mechanics.  
9. Render shared-mode only from sanitized objects.  
10. Prevent cross-context AI leaks.  
11. Provide skeleton loaders for heavy panels.  

---

# 15. Template Versioning Rules

Every ValueModelTemplate must support version control:

- A new version is created whenever:
  - A question is added, removed, or edited.
  - A weight is modified.
  - Section structure is updated.
- Version metadata must include:
  - versionNumber
  - createdByUserId
  - createdAt
  - changeSummary
- Assessments must ALWAYS reference the template version they were created with.
- Templates cannot be edited in place; all changes must create a new version.
- Deprecated templates remain available for historical assessments but are hidden from new assessment creation.

# 16. Cross-Vendor Normalisation Model (Buyer Mode)

When comparing multiple vendors:

- Numeric responses across vendors must be normalised onto a consistent scale.
- Normalisation must occur per question before section weighting:
  - min-max scaling or z-score scaling may be used.
- Buyer may choose weighting for:
  - technical fit
  - cost impact
  - risk
  - value drivers
- The comparison engine must:
  - Compute a weighted total per vendor.
  - Display per-section variance.
  - Avoid exposing detailed calculations in shared or vendor views.

---

# 17. Scenario Lock Metadata

Locked scenarios must include:
- lockedAt (timestamp)
- lockedByUserId
- reason (optional text)
- versionNumber (if based on a template version snapshot)

Locked scenarios may only be duplicated, not edited.

---

# 18. Summary

ValueSphere is:

- The structured language of value for the entire Agama platform  
- A system supporting both seller and buyer modes
- A structured collaboration engine inside Rooms  
- A multi-vendor comparison engine for ProcurePath  
- A deal justification engine for executive decisions  
- Permission-sensitive and AI-powered  

This file defines the complete functionality and behaviour needed for engineering and Codex to implement ValueSphere in full.

---

**End of valuesphere.md**
