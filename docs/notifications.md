# notifications.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Notification & Alerting Specification  
Last Updated: (update before commit)

Notifications allow users to stay aware of activity across RevenueForge, ProcurePath, Engagement Rooms, RFX, ValueSphere, tasks, documents, integrations, and organisation membership.

Notifications must be:
- Real-time (WebSockets/SSE)
- Permission-safe
- Persona-specific (vendor, buyer, guest)
- Visible only as appropriate
- Minimal, actionable, and contextual

This file defines the complete notifications engine.

---

# 1. Purpose of Notifications

Agama notifications provide:

1. Awareness of collaboration activity  
2. Prompt action on tasks and RFX responses  
3. Transparency on value modelling, document changes, and shared context  
4. Governance and accountability  
5. AI-assisted insights delivered to the user at the right time  
6. Cross-suite engagement without leaking sensitive data  

Notifications form the backbone of day-to-day user experience and must be fully consistent across all product surfaces.

---

# 2. Notification Channels

Agama supports two channels:

## 2.1 In-App Notifications (Immediate)
Delivered via:
- Notification bell icon  
- Dropdown menu  
- Full notification center  

In-app notifications are required for MVP.

## 2.2 Email Notifications (Later Phase)
Triggered via:
- SMTP provider (SendGrid, Postmark, or Resend)  
- WorkOS email templates for invites  
- Digest summaries (optional future feature)

Email notifications must:
- Only send user-allowed email types  
- Never leak vendor-only or buyer-only information  

---

# 3. Notification Object Specification

As defined in `domain_model.md`, a notification has:

Fields:
- `_id: ObjectId`
- `userId: ObjectId`
- `orgId: ObjectId`
- `type: string`
- `title: string`
- `body: string`
- `entityType?: string`
- `entityId?: ObjectId`
- `read: boolean`
- `createdAt: Date`
- `readAt?: Date`

Rules:
- Every notification belongs to exactly one `userId`
- Notifications must respect the visibility of their source events
- AI-generated notifications must be marked as such

Valid entityTypes include:
- EngagementRoom  
- RoomMessage  
- RoomTask  
- RoomDocument  
- Rfx  
- RfxResponse  
- RfxSection  
- RfxQuestion  
- ValueAssessment  
- SourcingEvent  
- IntegrationState  
- OrganizationMembership  

---

# 4. Notification Categories (Full Taxonomy)

Agama must support the following categories:

## 4.1 Engagement Room Notifications
- User invited to Room  
- New Room message  
- Mention in Room message  
- Shared MAP task assigned to user  
- Shared MAP task updated  
- Document uploaded  
- Document updated (new version)  
- Architecture version published  
- Shared ValueSphere updated  
- RFX clarification posted  
- RFX amendment posted  
- Room status changed (draft → active → closed)

## 4.2 RevenueForge Notifications (Vendor-Side)
- New stakeholder added  
- Qualification fields updated  
- AI risk insight generated  
- Account health drops below threshold  
- New Gong/Clari signal  
- Internal MAP task assigned  
- Room created from this account  
- Architecture draft updated  

## 4.3 ProcurePath Notifications (Buyer-Side)
- RFX draft created  
- RFX issued  
- Vendor submitted RFX response  
- Evaluation required from user  
- Approval step ready for user  
- Risk flag detected  
- New VendorRecord added  
- SourcingEvent stage change  
- AI scoring suggestions ready  

## 4.4 ValueSphere Notifications
- New ValueAssessment created  
- Assessment shared  
- Scenario updated  
- Assumptions modified  
- Assessment moved to agreed  
- Assessment moved to locked  

## 4.5 Organisation Membership Notifications
- Invite received  
- Invite accepted  
- User role changed  
- Suite entitlement updated  
- Super User rights assigned  

## 4.6 Integration Notifications
- CRM sync failure  
- Gong API error  
- Clari API error  
- Email/calendar integration issue  
- Procurement ERP failure  
- Integration successfully reconnected  

---

# 5. Notification Visibility & Permissions

Notifications must obey all visibility rules defined in `roles_permissions.md`.

## 5.1 Vendor-Only Notifications
Visible to:
- Vendor Suite users in vendor org  
- Org Owner/Admin (if applicable)  

Examples:
- Internal MAP update  
- Qualification changes  
- Vendor competitive intel  
- Gong/Clari risk  

Not visible to:
- Buyers  
- Guests  

## 5.2 Buyer-Only Notifications
Visible to:
- Buyer Suite users in buyer org  
- Buyer SU, Buyer Admin  

Examples:
- Scoring required  
- Approval needed  
- Risk flag  
- Vendor comparison updates  

Not visible to:
- Vendors  
- Guests  

## 5.3 Shared Notifications
Visible to:
- Vendor participants  
- Buyer participants  
- Guests  

Examples:
- Shared MAP updates  
- Shared architecture updates  
- Shared docs  
- RFX clarifications  

## 5.4 Guest Notifications
Guests only receive:
- Invites  
- Shared updates  
- Mention notifications  

Guests never receive:
- Buyer-only or vendor-only notices  

---

# 6. Notification Priority Levels

Notifications fall into urgency levels:

1. **Critical** — Tasks overdue, RFX deadlines, approval escalation, risk alerts  
2. **Important** — RFX responses, MAP assignments, architecture updates  
3. **Informational** — Comments, mentions, shared document updates  

Notifications must surface priority visually:
- Critical → highlight with theme-coloured high-urgency border/icon  
- Important → normal badge  
- Informational → dim badge  

---

# 7. Notification Delivery Rules

## 7.1 Trigger → Fan-out
When an event occurs:

1. System determines which users should be notified  
2. Filters users based on:
   - Role  
   - Suite entitlement  
   - RoomParticipant role  
   - Visibility mode (shared/vendor_only/buyer_only)  
3. Dispatches notification(s) to correct recipients  

## 7.2 In-App Delivery
Delivered immediately if user is:
- Logged in  
- Subscribed  
- Has permissions  

Otherwise added to notification center.

## 7.3 Email Delivery
Email is optional and controlled by:
- NotificationPreferences.email  
- High-severity events (optional future override)  

Email must NEVER include:
- Buyer-only data sent to vendors  
- Vendor-only data sent to buyers  
- Internal risk/comparison/scoring  

Email content must be sanitized accordingly.

---

# 8. Notification Center UI

UI requirements:

- Accessible via bell icon in top navigation  
- Badge count shows unread items  
- Dropdown preview:
  - Up to 10 most recent notifications  
  - “View All” link  
- Full-page center:
  - Filter by category  
  - Filter by entity  
  - Filter by read/unread  
  - Infinite scroll  

Each notification entry shows:
- Icon (represents category)  
- Title  
- Body snippet  
- Timestamp  
- Theme colour  
- Entity link (Open Room, Open Assessment, Open Account, etc.)  

---

# 9. Read/Unread Lifecycle

States:
- unread (default)  
- read (after click or dropdown view)  
- archived (future option)  

Rules:
- Opening notification detail marks it as read  
- Soft read can occur when dropdown is opened if configured  
- Backend must record readAt timestamp  

Actions:
- Mark all as read  
- Delete (future option)  

---

# 10. Notification Event Triggers (Full List)

Below is the exhaustive list of all system events that must trigger notifications.

## 10.1 Engagement Room Triggers
- New message created  
- Mention detected  
- Shared MAP task created  
- Shared MAP task updated  
- Document uploaded  
- Document version added  
- Architecture published  
- Internal architecture synced to shared version  
- Shared ValueSphere updated  
- RFX question clarification posted  
- RFX amendment posted  
- RFX issuance  
- Room status change  
- Guest invited  
- Guest accepted invite  

## 10.2 RevenueForge Triggers
- Stakeholder added  
- Stakeholder sentiment changed  
- Qualification field changed  
- MAP item created or updated  
- AI risk insight created (vendor-only)  
- CRM sync issues  
- Clari/Gong integration insights  
- Account health deteriorates  
- Architecture draft updated  

## 10.3 ProcurePath Triggers
- RFX created  
- RFX issued  
- Vendor submitted RFX response  
- Evaluation required  
- Evaluation completed  
- Approval step assigned  
- Approval completed  
- Internal buyer risk escalations  
- VendorRecord updates  
- SourcingEvent stage changes  

## 10.4 ValueSphere Triggers
- Assessment created  
- Assessment shared  
- Assessment updated  
- Scenario updated  
- Assessment locked  
- Agreement status reached  

## 10.5 Org/User Triggers
- User invited  
- User accepted  
- User suspended  
- User suite entitlements changed  
- Super User role assigned  
- WorkOS SSO connected or updated  

## 10.6 Integration Triggers
- CRM sync error  
- Gong connection failure  
- Clari ingest error  
- Email/calendar connection failure  
- Procurement ERP sync error  
- Integration recovery  

---

# 11. AI in Notifications

AI may generate notification content only when:

- The notification is about shared content  
- Or the notification is vendor-only  
- Or the notification is buyer-only  
- AND content uses only allowed context  

AI may NOT:
- Merge buyer-only and vendor-only sources  
- Reveal internal scores, risk notes, or competitive intel  
- Reveal fields not visible to the recipient  

Acceptable AI outputs:
- “Your RFX response draft is inconsistent with other answers.” (seller-side)  
- “Two evaluation criteria remain unscored.” (buyer-side)  
- “MAP item X is overdue.” (shared)  
- “ValueSphere scenario shows missing assumptions.” (shared or seller/buyer internal depending on source)

### 11.1 Notification Digest and Mute Rules

Users may configure the following preferences:

- muteAll: boolean
- muteRoomIds: string[]
- muteCategories: string[]
- emailDigestFrequency: none | daily | weekly

Digest Rules:
- Digests contain only notifications the user is already permitted to see.
- Buyer-only items appear only in buyer digests.
- Vendor-only items appear only in vendor digests.
- Shared items appear in any digest.

Mute Rules:
- Muted categories suppress notifications in real time but keep them in history.
- Muted rooms suppress all notifications originating from those rooms except direct mentions.


---

# 12. Backend Implementation Rules (Codex Must Follow)

Codex MUST:

1. Use the Notification object defined in domain_model.md.  
2. Enforce strict permission filtering before delivering any notification.  
3. Support real-time delivery using the collaboration engine.  
4. Write all notification events into persistent storage.  
5. Implement read/unread lifecycle as specified.  
6. Use correct theme colours for UI elements.  
7. Build a full notification center page.  
8. Build dropdown preview panel.  
9. Ensure AI-generated notifications follow visibility constraints.  
10. Add audit entries for major notification-driving events.  

---

# 13. Notification Visibility Matrix

Vendor Users may receive:
- Room shared activity
- Vendor-only task updates
- Vendor-side integration alerts
- Seller ValueSphere updates
- RevenueForge account alerts

Buyer Users may receive:
- Room shared activity
- Buyer-only task updates
- RFX timeline updates
- Buyer ValueSphere updates
- Procurement integration alerts

Guests may receive:
- Only shared activity notifications

AI must not generate notifications outside permitted category visibility.

---

# 14. Summary

This document defines the full **notification engine** for Agama, including:

- Data models  
- User preferences  
- In-app vs email delivery  
- Permission-aware filtering  
- Category taxonomy  
- Trigger rules  
- Engagement Room integration  
- RFX integration  
- ValueSphere integration  
- RevenueForge integration  
- ProcurePath integration  
- AI behaviour  
- Read/unread lifecycle  
- Codex implementation requirements  

All future additions must update this file and maintain strict cross-suite privacy boundaries.

---

**End of notifications.md**
