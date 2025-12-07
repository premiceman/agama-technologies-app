# user_profile.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for User Profiles  
Last Updated: 2024-05-08

The Agama User Profile system provides identity, metadata, preferences, presence, role context, and interaction provenance across RevenueForge, ProcurePath, Engagement Rooms, ValueSphere, and RFX workflows.

The user profile is NOT a cosmetic feature — it is central to:
- Task assignment  
- Room participation  
- Stakeholder management  
- RFX authorship  
- ValueSphere responses  
- Notifications  
- Org permissions  
- Team collaboration  
- Guest onboarding and PLG conversion  

This document defines the complete user profile architecture.

---

# 1. Purpose of User Profiles

User profiles serve five critical functions:

1. **Identity** – establishes who the user is in all collaboration surfaces.  
2. **Context** – provides job role, department, title, and org membership view.  
3. **Assignment** – required for tasks, MAP ownership, approvals, and scoring.  
4. **Visibility** – allows other participants to understand who is active and involved.  
5. **Governance** – allows org admins to manage roles, entitlements, and permissions.  

Profiles appear everywhere across the platform and must be consistent across all products.

---

# 2. Profile Data Model

This reflects the `User` and `UserProfile` objects defined in `domain_model.md`.

## 2.1 User
Global identity record.

Fields:
- `_id`
- `primaryEmail`
- `authProviderId` (WorkOS ID)
- `status` (active, suspended)
- `createdAt`
- `lastLoginAt`
- `globalPreferences`:
  - language  
  - timezone  
  - darkMode  

## 2.2 UserProfile
Presentation and preference layer.

Fields:
- `userId`
- `name`
- `title`
- `department`
- `avatarUrl`
- `phoneNumber`
- `timezone`
- `persona: 'vendor' | 'buyer' | 'both'` (UI and AI preference; does **not** grant access)
- `notificationPreferences`:
  - `inApp: boolean`
  - `email: boolean`

## 2.3 OrganizationMembership (context-dependent)
Defines:
- Role (org_owner, org_admin, user)
- Suite entitlements (per suite seat):
  - vendorSuite
  - buyerSuite
- SuperUser flags:
  - vendor
  - buyer
- Status (active, pending_invite, suspended)

Entitlements and access derive exclusively from `OrganizationMembership` and its suite flags. Persona and any license descriptors are preferences only and never influence permissions.

Profile rendering MUST reflect current `OrganizationMembership`.

---

# 3. Profile Visibility Rules

Profiles must obey all cross-org and cross-panel visibility rules.

## 3.1 Vendor Perspective
Vendor users see:
- Their own org’s users  
- Guest users in Rooms  
- Buyer Suite users inside a Room (name, title, avatar only)

Vendor users do NOT see:
- Buyer org membership details  
- Buyer suite entitlements  
- Buyer department, email, phone unless explicitly shared  
- Any buyer-only data

## 3.2 Buyer Perspective
Buyer users see:
- Their own org’s users  
- Vendor participants in shared Rooms  
- Guest participants  

Buyer users do NOT see:
- Vendor org membership data  
- Vendor department  
- Vendor internal roles or suite entitlements  

## 3.3 Guest Perspective
Guests see:
- Only participants in shared panels  
- No roles  
- No org breakdown  
- No suite information  
- No internal metadata  

Profile details shown to guests must be minimal and sanitized.

---

# 4. Profile Locations Across Agama

User profiles appear in:

- RevenueForge (vendor-only)  
- ProcurePath (buyer-only)  
- Engagement Rooms (shared context)  
- Stakeholder mapping (vendor-side only)  
- RFX response authorship (vendor)  
- RFX evaluation reviewers (buyer)  
- ValueSphere responders (seller/buyer/shared)  
- Approvals workflow (ProcurePath)  
- Tasks & MAP items (shared and internal)  
- Comments, messages, mentions  

Each use-case must show profile data consistent with visibility rules.

---

# 5. Profile Fields (Detailed Specification)

## 5.1 Name
- Always visible  
- Primary identifier across all objects  

## 5.2 Job Title
- Visible across all shared and private contexts  
- Guests: optional  

## 5.3 Department
- Visible only:
  - Vendor → to vendors  
  - Buyer → to buyers  
- NOT visible cross-org  

## 5.4 Avatar
- Visible in all contexts  
- Default silhouette if missing  

## 5.5 Contact Details (email/phone)
- Visible only inside the user’s own org  
- Visible to other org only if explicitly shared  
- Guests see no contact data by default  

## 5.6 Timezone
Used for:
- Deadlines  
- Task alignment  
- Scheduling interactions  
- Notification timestamps  

## 5.7 Notification Preferences
- `inApp: true/false`  
- `email: true/false`  

Defaults:
- In-app → enabled  
- Email → disabled until Phase 2  

---

# 6. Profile Editing

## 6.1 Users May Edit:
- Name  
- Title  
- Department  
- Avatar  
- Phone  
- Timezone  
- Preferences  

## 6.2 Users May NOT Edit:
- Roles  
- Suite entitlements  
- SuperUser flags  
- Org membership  
- WorkOS identity  

Those are managed by Org Admin or Org Owner.

---

# 7. Profile in Assignments

User profiles drive:

## 7.1 MAP Assignment
Each task contains:
- Assigned userId  
- Assignee avatar & name  
- Tooltip containing title and department (same org only)

## 7.2 Shared MAP
Vendor and buyer can assign tasks ONLY to:
- Their own org users  
- Guests (optional)

## 7.3 RFX Assignments
Vendor:
- Answers are tied to vendor’s user profile (submittedByUserId)

Buyer:
- Scoring & evaluation linked to reviewer profiles  
- Visibility restricted to buyer org only  

## 7.4 Approvals (Buyer Side)
Approval steps show:
- Approver name  
- Title  
- Org role (buyer side)
- Avatar  

Vendors never see buyer approver identities.

---

# 8. Profile in Messaging and Mentions

Profiles appear in messaging threads inside Rooms.

## 8.1 Messages
Each message shows:
- Avatar  
- Name  
- Timestamp  

Users see only the profile metadata allowed by visibility rules.

## 8.2 Mentions
Dropdown shows:
- Vendor participants (for vendors)  
- Buyer participants (for buyers)  
- Shared participants (for both)  

Guests may mention only:
- Shared participants  
- Cannot mention vendor/buyer internal participants  

---

# 9. Org Switching Behaviour

Users with membership in multiple orgs MUST have an org switcher.

Switcher shows:
- Org name  
- Org role (owner/admin/user)  
- Suite entitlements for that org  

Switching org updates:
- Global navigation  
- Dashboard  
- Access permissions  
- Profile context  

Codex must ensure:
- Suite entitlements are per-org  
- Room access depends on orgContext + RoomParticipant  

---

# 10. Guest Profile Handling

Guests create lightweight profiles.

## 10.1 Guest Profile Fields
- Name (required)  
- Avatar (optional)  
- Job title (optional)  
- Minimal preferences  

## 10.2 Guest Limitations
Guests have:
- No org membership  
- No suite entitlements  
- No admin privileges  
- No access to internal panels  

Guests ONLY operate inside Rooms.

## 10.3 Guest → Customer Conversion
When a guest becomes a paying user:
- They create an organisation (buyer or vendor)  
- Their profile becomes a full profile  
- Their RoomParticipant roles update accordingly  

---

# 11. AI in User Profiles

AI may use profile data ONLY for:

- Tailored summaries (“Tasks assigned to you…”)  
- Mention suggestions  
- Internal navigation recommendations (“Open Room X”)  
- Stakeholder sentiment aggregation (vendor-only)  
- Notification summarisation  

AI must NOT:
- Infer any buyer-only or vendor-only role not visible to the user  
- Produce content based on private profile fields in another org  
- Use guest metadata beyond what is visible  

---

# 12. Profile Security Rules

Certain profile fields require masking or restriction:

- Email and phone number must not be shown cross-org unless explicitly permitted.
- Department and role must not leak across org boundaries.
- Internal titles such as "Org Owner", "SuperUser", or "Procurement Lead" must not appear in shared or guest views.
- Profile cards in shared or guest contexts must never include internal metadata.

Masked profile format:
- Show: name, avatar
- Hide: email, phone, department, entitlements, roles

# 13. Cross-Organisation Identity Behaviour

Users belonging to multiple organisations:

- Must explicitly select org context on login.
- Profile panels must refresh to show metadata for the chosen org only.
- Tasks, notifications, and dashboards must appear only for the active org.
- Engagement Rooms only appear when the RoomParticipant.orgId matches the active org or the user is a guest.

Codex must ensure no leakage between org contexts when switching.

---

# 14. UI Specifications for User Profiles

Profile UI must match:

- Theme inheritance from surface context  
- Liquid glass card design  
- Consistent layout across products  

Components:
- Profile card  
- Settings panel  
- Contact detail card  
- Preferences panel  
- Org membership list  
- Suite entitlements panel  
- Profile avatar uploader  

For guests:
- Minimalist profile card  
- Greyed-out non-editable sections  

Accessibility:
- Support keyboard navigation  
- On-hover profile previews  
- High-contrast modes for readability  

---



# 15. Backend Rules (Codex Implementation)

Codex MUST:

1. Implement full User + UserProfile + OrganizationMembership model.  
2. Load UserProfile for all UI contexts where identities appear.  
3. Enforce visibility rules at API level:  
   - Buyer-only data hidden from vendors  
   - Vendor-only data hidden from buyers  
   - Internal org data hidden from guests  
4. Build profile editing flows (self-service).  
5. Implement Org Switcher UI + backend session updates.  
6. Ensure Guest profiles are separate from OrganisationMembership.  
7. Support profile-based task assignment.  
8. Respect notification preferences.  
9. Integrate profile data into search engine indexing (Phase 2).  
10. Log profile changes in `AuditLog`.  

---

# 16. Summary

User profiles are the backbone of Agama’s identity system. They:

- Define user identity, metadata, and preferences  
- Enable collaboration in Rooms  
- Drive assignment in MAP, RFX, approvals, and ValueSphere  
- Enforce visibility boundaries across vendors, buyers, and guests  
- Support PLG flows through guest → org onboarding  
- Provide essential context across every product surface  

This document defines the complete behaviour required for Codex and engineering to implement user profiles.

---

**End of user_profile.md**
