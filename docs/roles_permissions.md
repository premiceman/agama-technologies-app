# roles_permissions.md — Agama Technologies

Version: 2.0
Owner: Agama Technologies
Status: Authoritative Role & Permission Specification
Last Updated: 2024-05-07

This document defines Roles and Permissions using **org roles** plus **suite flags**. Every rule below is expressed only in terms of:

- Org roles: `org_owner`, `org_admin`, `vendor_user`, `buyer_user`, `guest`.
- Suite flags: `vendorSuiteEnabled`, `buyerSuiteEnabled` (Vendor Suite / Buyer Suite / Both / None).
- Room participation for guests.

No other tiers exist in this specification.

---

## 1. Org Roles

| Org Role    | Description                                          | Scope |
|-------------|------------------------------------------------------|-------|
| org_owner   | Ultimate authority; controls billing and governance. | Org   |
| org_admin   | Operational admin; manages membership and settings.  | Org   |
| vendor_user | Standard member working as a seller.                 | Org   |
| buyer_user  | Standard member working as a buyer.                  | Org   |
| guest       | External participant invited into an Engagement Room | Room  |

Org owners and admins inherit the capabilities of vendor_user or buyer_user when the relevant suite flag is enabled.

---

## 2. Suite-Based User Types

| Suite Combination | Flags                                             | Behaviour |
|-------------------|---------------------------------------------------|-----------|
| Vendor Suite user | `vendorSuiteEnabled = true`, `buyerSuiteEnabled = false` | Access vendor capabilities only. |
| Buyer Suite user  | `buyerSuiteEnabled = true`, `vendorSuiteEnabled = false` | Access buyer capabilities only. |
| Both Suites user  | `vendorSuiteEnabled = true`, `buyerSuiteEnabled = true`  | Access both vendor and buyer capabilities within the relevant org context. |
| Guest             | No suite flags; participates only in invited Engagement Rooms. | Room-scoped, minimal permissions. |

Org owners/admins follow the same suite combination rules; they do not gain cross-suite powers without the corresponding flag.

---

## 3. Permission Reference by Product Area

Each subsection lists who can **create**, **view**, and **edit** based on role and suite flags. “Both Suites” implies the user has both flags on and is operating in the matching context.

### 3.1 RevenueForge (Vendor Suite)

| Role + Suite                       | Create | View | Edit |
|------------------------------------|--------|------|------|
| org_owner/admin with Vendor Suite or Both Suites | ✔ (accounts, opportunities, Engagement Rooms) | ✔ | ✔ |
| vendor_user with Vendor Suite or Both Suites     | ✔ | ✔ | ✔ |
| buyer_user with any suite combination            | ✖ | ✖ | ✖ |
| guest (no suites)                                | ✖ | ✖ | ✖ |

### 3.2 ProcurePath (Buyer Suite)

| Role + Suite                       | Create | View | Edit |
|------------------------------------|--------|------|------|
| org_owner/admin with Buyer Suite or Both Suites  | ✔ (vendor records, sourcing events, RFX) | ✔ | ✔ |
| buyer_user with Buyer Suite or Both Suites       | ✔ | ✔ | ✔ |
| vendor_user with any suite combination           | ✖ | ✖ | ✖ |
| guest (no suites)                                | ✖ | ✖ | ✖ |

### 3.3 ValueSphere

| Role + Suite                       | Create | View | Edit |
|------------------------------------|--------|------|------|
| org_owner/admin with Vendor Suite or Both Suites | ✔ (seller-mode assessments/templates) | ✔ | ✔ |
| vendor_user with Vendor Suite or Both Suites     | ✔ | ✔ | ✔ |
| org_owner/admin with Buyer Suite or Both Suites  | ✔ (buyer-mode assessments/templates)  | ✔ | ✔ |
| buyer_user with Buyer Suite or Both Suites       | ✔ | ✔ | ✔ |
| guest (room participant)                         | ✖ | Limited view if explicitly exposed via Engagement Room | ✖ |

### 3.4 Engagement Rooms

| Role + Suite                       | Create | View | Edit |
|------------------------------------|--------|------|------|
| org_owner/admin with Vendor Suite or Both Suites | ✔ (vendor-side room creation and invitations) | ✔ | ✔ on vendor-side content |
| vendor_user with Vendor Suite or Both Suites     | ✔ (vendor-side room creation and invitations) | ✔ | ✔ on vendor-side content |
| org_owner/admin with Buyer Suite or Both Suites  | ✔ (buyer-side room creation, sourcing events, invitations) | ✔ | ✔ on buyer-side content |
| buyer_user with Buyer Suite or Both Suites       | ✔ (buyer-side room creation where allowed) | ✔ | ✔ on buyer-side content |
| guest (invited participant)                      | ✖ | ✔ for invited room surfaces | Limited (can post messages or upload files if host allows) |

Room content respects the side of the participant: vendor roles edit vendor-side materials, buyer roles edit buyer-side materials, and Both Suites users choose context per room. Guests never gain vendor or buyer internal visibility outside the invitations they receive.

---

## 4. General Enforcement Rules

1. Determine org role and suite flags from the user’s membership.
2. Deny access to RevenueForge unless `vendorSuiteEnabled` is true.
3. Deny access to ProcurePath unless `buyerSuiteEnabled` is true.
4. Within ValueSphere and Engagement Rooms, apply the side-specific rules above; Both Suites users must explicitly act in either vendor or buyer context.
5. Guests are always restricted to the specific Engagement Rooms where they are invited and cannot create or edit org-scoped objects.
6. All create/edit actions by org_owner or org_admin still require the relevant suite flag for the corresponding workspace.

---

**End of roles_permissions.md**
