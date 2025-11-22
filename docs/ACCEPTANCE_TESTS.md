
---

### 2.6 `docs/ACCEPTANCE_TESTS.md`

```md
# Acceptance Tests

These scenarios describe expected end-to-end behaviours of the Agama Collaboration and Engagement Room features.

They should be used as a high-level checklist for implementation and automated tests.

---

## Scenario 1: Vendor creates an Engagement Room and adds internal members

**Given** I am logged in as a full user in a vendor organisation with access to RevenueForge  
**And** I am viewing a specific `RevenueAccount`  
**When** I click "Create Engagement Room"  
**And** I select a buyer organisation and confirm  
**Then** an `EngagementRoom` is created linking the vendor org, buyer org, and revenue account  
**And** I am added as a `room_admin` member of the room  
**And** I can see the room in my room list

**When** I search my organisation's user directory from within the room and add 2 colleagues as members  
**Then** they appear in the room members list with the chosen roles

---

## Scenario 2: Project management table is used to track onboarding tasks

**Given** I am a `room_admin` or `editor` in an Engagement Room  
**When** I open the "Project Board" tab  
**And** I create several issues with titles, descriptions, statuses, assignees, and due dates  
**Then** those issues are saved and visible in the project's table view

**When** I change an issue's status from `not_started` to `in_progress`  
**Then** the change is persisted and visible to all room members

**When** I set an issue to `stuck` and add notes explaining the blocker  
**Then** other members can read the notes and filter for `stuck` issues

---

## Scenario 3: Vendor invites a customer guest by email and they join via WorkOS

**Given** I am a `room_admin` in an Engagement Room  
**And** the linked buyer organisation does not yet have full Agama licenses  
**When** I open the "Members" tab and create an invite by entering the customer's email and selecting `viewer` role with `isGuestInvite = true`  
**Then** an `EngagementRoomInvite` record is created with status `pending`

**When** the customer receives the invite and logs in via WorkOS  
**And** they visit the invite acceptance URL (containing the token)  
**Then** the application matches their WorkOS email to the invite  
**And** creates a `User` with `licenseTier = 'guest'` if it does not exist  
**And** creates an `EngagementRoomMembership` with `isGuest = true`  
**And** marks the invite as `accepted`

**Then** the guest user can see only:
- The Engagement Room they were invited to
- Messages, issues, deliverables, and documents within that room

**And** they cannot:
- Browse the vendor's full user directory
- Access any other rooms they were not invited to
- Access billing or configuration pages

---

## Scenario 4: Vendor and buyer collaborate on documents in a room

**Given** a vendor editor uploads a SoW document to an Engagement Room  
**When** a buyer guest accesses the room  
**Then** they can view the document metadata and download the latest version

**When** the buyer adds comments to the document (via the file comments feature)  
**Then** those comments are visible to vendor members in the room

**When** a room member triggers "AI Validation" for the SoW  
**Then** the backend calls OpenAI as defined in `AI_SPEC.md`  
**And** returns a structured summary of risks, missing items, and recommendations  
**And** that result can be viewed and discussed in the room

---

## Scenario 5: Status report is generated for stakeholders

**Given** a room has several open issues, completed deliverables, and recent messages  
**When** a user clicks "Generate Status Report" and selects `audience = 'joint'`  
**Then** the backend calls the Room Status Report Copilot  
**And** returns:
- A headline
- Overall status (on_track/at_risk/off_track)
- Lists of completed, in-progress work, blockers, and recommended actions

**When** the user posts this status report into the room  
**Then** it appears as an `ai_summary` message in the message feed  
**And** all room members (including guests) can read it

---

## Scenario 6: Guest access is tightly controlled

**Given** I am logged in as a `guest` user  
**When** I hit `/api/org/users/search`  
**Then** I receive a `403 Forbidden` response

**When** I attempt to access `/api/rooms/:roomId` for a room I am not a member of  
**Then** I receive a `404` or `403` and no room data

**When** I navigate the UI  
**Then** I see only the rooms I have memberships for  
**And** I do not see navigation links to administrative or configuration sections
