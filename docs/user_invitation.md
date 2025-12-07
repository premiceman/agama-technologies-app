# user_invitation.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for User & Guest Invitation System  
Last Updated: (update before commit)

This document defines the complete invitation and onboarding architecture for Agama.  
It covers internal user invites, guest invites, WorkOS integration, organisation creation, suite entitlement assignment, role assignment, and cross-org collaboration rules.

Invitations are central to:
- Onboarding vendor organisations  
- Onboarding buyer organisations  
- Inviting external stakeholders into Engagement Rooms  
- Converting guests into suite customers  
- Creating secure cross-organisation collaboration  

This file ensures that the entire user lifecycle is permission-safe, scalable, and compatible with WorkOS authentication.

---

# 1. Invitation Types

Agama supports two invitation types:

1. **Internal User Invitation**  
   - Creates or updates an OrganizationMembership  
   - Assigns suite entitlements (vendorSuite, buyerSuite)  
   - Assigns org roles (org_owner, org_admin, user)  
   - Uses WorkOS SSO authentication flow  

2. **Guest Invitation (Room-Specific)**  
   - Allows external users to join a single Engagement Room  
   - Creates a minimal guest User + RoomParticipant  
   - No suite entitlements  
   - No organisation membership required  
   - Uses magic link authentication  

Internal users are org-bound; guests are room-bound.

Both invitation types use the `Invite` object defined in `domain_model.md`.

---

# 2. Invite Object Specification

Fields:
- `_id`
- `email`
- `orgId?`
- `roomId?`
- `isGuest` (boolean)
- `roleAssignments` (optional):
  - `orgRole`  
  - `vendorSuite`  
  - `buyerSuite`  
  - `superUser { vendor?, buyer? }`  
- `invitedByUserId`
- `token`
- `status: pending | accepted | expired | revoked`
- `expiresAt`
- `createdAt`
- `acceptedAt?`

Rules:
- Internal invite → `orgId` required, `isGuest = false`  
- Guest invite → `roomId` required, `isGuest = true`  
- `expiresAt` default = 7 days  
- Tokens must be signed, single-use, immutable  

---

# 3. Internal User Invitation Flow

Internal invites onboard people into an Organisation.

## 3.1 Flow Overview

1. Org Owner/Admin opens **Organisation Settings → Users**  
2. Enters email(s)  
3. Selects:
   - Org Role (owner, admin, user)  
   - Vendor Suite entitlement  
   - Buyer Suite entitlement  
   - SuperUser flags  
4. System creates `Invite` object  
5. Email is sent with a **WorkOS SSO invite link**:
   - https://agama.app/invite?token=XYZ  
6. User clicks link  
7. User signs in via WorkOS:
   - If new user → create User record  
   - If existing user → attach invitation  
8. Invitation is validated, consumed, and:
   - OrganizationMembership is created or updated  
   - Suite entitlements are assigned  
   - SuperUser flags applied  
9. Redirect:
   - Vendor Suite → RevenueForge  
   - Buyer Suite → ProcurePath  
   - Dual Suite → dashboard with mode selector  

## 3.2 Edge Cases

### Existing user in another org  
User will now belong to multiple Organisations.  
Context switching is required.

### Email domain mismatch  
WorkOS domain restrictions may require:
- Admin override  
- SCIM integration (enterprise)  

### Invite to user who is already a member  
- Update entitlements  
- Update role  
- Mark invite as accepted  
- No new membership created  

### Internal user invited as guest  
Not allowed: internal users must join org via internal invite.

---

# 4. Guest Invitation Flow (Room-Based)

Guest invitations allow non-Agama users to join a specific Room.

## 4.1 Flow Overview

1. Vendor or buyer user opens **Room → Participants → Invite Guest**  
2. Enters guest email  
3. System creates `Invite` with:
   - `isGuest = true`  
   - `roomId` set  
   - No orgId  
   - No suite entitlements  
4. Email is sent with **magic link**:
   - https://agama.app/guest?token=XYZ  
5. User clicks link  
6. User creates lightweight Guest profile:
   - Name  
   - Job title (optional)  
   - Avatar (optional)  
7. System creates:
   - `User` (global)  
   - `RoomParticipant` with `role = guest`  
8. User is logged into the Room in shared-only mode  

## 4.2 Guest Permissions

Guests may:
- View shared panels  
- Send messages  
- Upload shared documents  
- Collaborate on shared MAP  
- Answer RFX questions if acting as vendor representative  

Guests may NOT:
- View vendor-only panels  
- View buyer-only panels  
- Access RevenueForge or ProcurePath  
- Manage org settings  
- Score RFX responses  

## 4.3 Guest → Buyer Suite Upsell Path

When a guest is behaving like a buyer (e.g., responding to RFX clarifications), Agama displays:

- “Unlock full Procurement Workspace”  
- “Organise vendors with ProcurePath”  
- “Gain access to evaluation, risk, and approvals”  

Upsell converts guest → org admin of a newly created buyer organisation.

---

# 5. Organisation Creation via Invitation

Some invites may implicitly create an Organisation.

## 5.1 Guest Convert → Full Buyer Organisation

When a guest accepts an upsell prompt:

1. Fill in org name  
2. Create Organisation  
3. User becomes `org_owner`  
4. Buyer Suite assigned automatically  
5. Existing RoomParticipant role upgraded from `guest` → `buyer_user`  

## 5.2 Single-User Vendor Org Creation

If a vendor invites a single external vendor user:

- That user becomes the `org_owner` of their own vendor org upon upgrade  

---

# 6. Mixed Invitation Scenarios

## 6.1 Inviting Vendors into a Buyer Org  
- Only possible through internal invite  
- Requires suite assignment  

## 6.2 Inviting Buyers into a Vendor Org  
- Allowed as Room Guests  
- Internal buyer-only content does not appear  

## 6.3 User in Multiple Orgs  
User sees an **Org Switcher** and must choose context on login.

## 6.4 Guest with multiple Room invites  
User accumulates multiple RoomParticipant entries.  
Does not create any org membership.

---

# 7. Bulk Invitation Workflow

Org Admins may upload a CSV to invite multiple internal users.

CSV must contain:
- Email
- Role
- vendorSuite (true/false)
- buyerSuite (true/false)
- superUserVendor (true/false)
- superUserBuyer (true/false)

System must:
- Validate email format
- Prevent duplicates
- Show preview of users and entitlements
- Create an Invite entry per row
- Send emails asynchronously

Errors must be reported clearly at row level.

# 8. Handling Inactive or Suspended Users

Users may be suspended by Org Admins or by system security rules.

Suspended users:
- Cannot log in
- Cannot accept invites
- Lose RoomParticipant access
- Are hidden from assignment dropdowns
- Are marked as “inactive” in MAP tasks and evaluations

Reactivation restores all membership and Room access.

---

# 9. WorkOS Integration

WorkOS is used for:

- SSO login  
- Organisation-bound authentication  
- Directory sync (future)  
- Magic link for guests (if not using a separate mechanism)  

## 9.1 Internal Invite Flow with WorkOS

- `invite?token=` endpoint triggers authentication  
- If user is not signed in → WorkOS login (SSO or email)  
- WorkOS returns user ID  
- Agama links User ↔ OrganizationMembership  
- Invite consumed  

## 9.2 Guest Flow with WorkOS or Native Magic Links

Guest invites may:
- Use WorkOS passwordless  
- Or internal magic links (recommended for simplicity)

Guest login must not require WorkOS org-binding.

---

# 10. Security & Permission Rules

## 10.1 Token Security

- Tokens must be:
  - Signed server-side  
  - Single-use  
  - Time-limited  
  - Scoped to invite type (internal/guest)  

- Token must embed:
  - inviteId  
  - email  
  - orgId or roomId  
  - isGuest flag  

## 10.2 Absolute Privacy Guarantees

Internal user invites must not reveal:
- Org secrets  
- Existing org members  
- Suite entitlements  
- Org structure  

Guest invites must not reveal:
- Vendor-only or buyer-only data  
- Org details  

## 10.3 Invitation Abuse Prevention

- Rate-limit invites per user  
- Require reCAPTCHA for public guests  
- Audit all invites  
- Auto-expire old tokens  

---

# 11. UI & UX Requirements

## 11.1 Internal Invite UI
Fields:
- Email  
- Role  
- Vendor Suite toggle  
- Buyer Suite toggle  
- SuperUser toggles  
- Send button  

Shows:
- Pending invites  
- Accepted invites  
- Expired invites  

## 11.2 Guest Invite UI (Inside Rooms)
Fields:
- Email  
- Optional message  
- Access limitations  

Shows:
- Each guest  
- Role = guest  
- Resend invite link  

## 11.3 Invite Acceptance Page
Must support two modes:
- Internal user acceptance (WorkOS-first)  
- Guest acceptance (profile creation)  

Must be fully responsive.

---

# 12. Email Templates

Agama requires email templates for:

- Internal invite email  
- Guest invite magic-link email  
- Invite expiration reminder (optional)  
- Upsell trigger email (guest → buyer suite)  

Templates must be:

- Theme-neutral  
- Accessible  
- Minimal  
- Professional  

No sensitive data included.

---

# 13. AI Integration

AI may help with:

- Suggesting invite roles (e.g., “This user appears to be a procurement manager”)  
- Drafting custom message for guest invites  
- Suggesting suite assignments based on usage data  

AI must NOT:
- Assign roles automatically  
- Leak internal data via invite messages  
- Infer competitor information  

---

# 14. Backend Implementation Rules (Codex Must Follow)

Codex MUST:

1. Use the `Invite` model exactly as defined.  
2. Implement both internal and guest invitation flows.  
3. Validate tokens before use.  
4. Enforce expiration.  
5. Prevent re-use of tokens.  
6. Enforce `isGuest` logic strictly.  
7. Create or update OrganisationMembership on internal invite.  
8. Create RoomParticipant on guest invite.  
9. Use WorkOS login for internal invites.  
10. Use magic link for guest invites.  
11. Prevent exposure of restricted Room panels during onboarding.  
12. Implement full audit logging.  
13. Provide meaningful UI errors for expired/invalid tokens.  
14. Use notifications to inform users of invitation status changes.  

---

# 15. Summary

The user and guest invitation system powers:

- Organisation onboarding  
- Buyer Suite onboarding  
- Vendor Suite onboarding  
- Guest collaboration in Engagement Rooms  
- PLG conversion from guest → suite customer  
- Multi-org user support  
- Permission-safe, isolated collaboration  

This document defines the full framework required for Codex and engineers to implement the invite system securely and scalably.

---

**End of user_invitation.md**
