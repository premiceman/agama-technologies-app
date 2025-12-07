# collaboration_engine.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Specification for Real-Time Collaboration Layer  
Last Updated: (update before commit)

The Collaboration Engine powers all real-time behaviours across Agama:

- Engagement Room messaging  
- Shared MAP updates  
- Architecture canvas updates  
- Document versioning indicators  
- RFX answering status updates  
- Shared ValueSphere updates  
- Presence indicators (who is online / in room)  
- Typing indicators  
- Live notifications  

This document defines the system architecture, event model, transport mechanism, visibility enforcement, and Codex implementation requirements.

---

# 1. Purpose & Goals

Agama’s Collaboration Engine must provide:

1. **Real-time updates** across vendor, buyer, and guest participation.  
2. **Strict permission-aware filtering** of events.  
3. **Low-latency** messaging and state propagation.  
4. **Guaranteed delivery** where required.  
5. **Room-scoped isolation** for multi-tenant safety.  
6. **AI-enhanced collaboration** without violating visibility rules.  
7. **Support for both ephemeral (presence, typing) and persistent events**.  

Real-time behaviour is central to the Engagement Room experience.

---

# 2. Architecture Overview

The Collaboration Engine operates as a real-time event layer on top of the backend.

Two possible transport modalities are supported:

## 2.1 WebSockets (Preferred)
Supports:
- Bi-directional communication  
- Low-latency notifications  
- Room-scoped channels  
- Presence  

## 2.2 Server-Sent Events (SSE) (Alternative)
Supports:
- Unidirectional server → client streaming  
- Lightweight channel setup  
- Good fallback for simpler deployments  

Codex must build the engine to abstract over either option.

---

# 3. Real-Time Channel Model

Every Engagement Room has a dedicated channel:

 - room:<roomId>


Additional channels include:

- `user:<userId>` (personal notifications)  
- `org:<orgId>` (for org-wide events like integration failures)  
- `rfx:<rfxId>` (only buyer-side)  
- `valuesphere:<assessmentId>` (optional future)  

Clients subscribe to channels based on:

- Active Room  
- User identity  
- Org context  
- Suite entitlements  
- RoomParticipant role  

All events are **permission-filtered** before being published.

---

# 4. Event Types

Events fall into persistent and ephemeral categories.

## 4.1 Persistent State Events
Persisted in database AND broadcast:

- New RoomMessage  
- Shared MAP task created  
- Shared MAP task updated  
- Document upload  
- Document version added  
- Architecture published  
- ValueSphere shared update  
- RFX question/clarification posted  
- RFX response submitted  
- RFX amendment  
- Room status change  
- ValueAssessment move (draft → shared → agreed → locked)  

Persistent events modify database state.

## 4.2 Ephemeral/UI Events (Not persisted)
- User joined room  
- User left room  
- User is typing  
- Presence heartbeat  
- Draft answer in progress (vendor-side only)  
- Cursor positions in shared canvases (future)  

Ephemeral events improve UX but do not affect system of record.

---

# 5. Presence System

Presence allows participants to see:

- Who is currently online  
- Who is currently in the same Room  
- Who is working on the same object (shared document, ValueSphere, RFX question)

## 5.1 Presence Payload
- `userId`
- `name`
- `avatarUrl`
- `role` (vendor_user, buyer_user, guest)
- `activePanel` (messages, documents, MAP, RFX, ValueSphere)
- `timestamp`

Presence must never reveal:
- Buyer-only presence to vendor users in buyer-only panels  
- Vendor-only presence to buyer users in vendor-only panels  

If a user is in a panel the viewer is not allowed to access, their presence is shown as:
- “User active (private panel)”

---

# 6. Typing Indicators

Typing events are ephemeral:

Payload:
- `userId`
- `roomId`
- `panel` (messages, MAP, RFX, ValueSphere)
- `isTyping: boolean`

Visibility:
- Vendor typing indicators visible in shared + vendor-only panels (vendor-to-vendor)  
- Buyer typing indicators visible in shared + buyer-only panels (buyer-to-buyer)  
- Shared typing indicators visible to everyone  

Typing indicators must NOT reveal:
- Activity in private panels to the opposite persona  

---

# 7. Message Engine

### Persistent Events:
- New message  
- Thread created  
- Mention  

### Broadcast Rules:
- Messages in shared tab → all participants  
- Messages in vendor-only tab → vendor users only  
- Messages in buyer-only tab → buyer users only  

Guests cannot see private panels.

Messages must be appended to:
- Event stream  
- Persistent storage  
- Notification system (if mention or reply)  

---

# 8. Shared MAP Collaboration

## 8.1 MAP Actions Create Events
- Task created  
- Task updated  
- Task completed  
- Dependency added  
- Due date changed  

## 8.2 Broadcast Rules
- Shared MAP updates → all participants  
- Vendor-only MAP updates → vendor only  
- Buyer-only MAP updates → buyer only  

## 8.3 Conflict Handling
Client must send:
- PATCH-style updates  
- Server merges  
- Last-writer-wins for MVP  
- CRDT strategy optional future enhancement  

---

# 9. Shared Document Collaboration

Document system is version-based, not real-time editing.  
Real-time collaboration is limited to:

- Document upload events  
- New version events  
- Comments added  
- Version status changes  

Document body contents are NOT transmitted live (to avoid uncontrolled leakage and complexity).

Broadcast:
- Shared documents → all  
- Vendor-only documents → vendor only  
- Buyer-only documents → buyer only  

---

# 10. Shared Architecture Workspace

The architecture workspace uses structured events:

- Component added  
- Component removed  
- Connection added  
- Comment added  
- Version published  

All operations must respect visibility:

- Vendor drafts invisible to buyers  
- Only published versions appear in shared panel  

Merging:
- Last-writer-wins for MVP  
- Comment threads synchronous  

---

# 11. Shared ValueSphere Collaboration

Shared-mode ValueSphere events include:

- Shared assessment created  
- Updates to shared fields  
- Scenario changes  
- Summary updates  

Buyers and vendors can collaborate on shared content only.  
Vendor-only and buyer-only ValueSphere events stay private.

---

# 12. RFX Collaboration

Vendors and buyers collaborate through structured RFX events:

Buyer → Shared events:
- Question added (draft mode remains buyer-only)
- Clarifications  
- Amendments  

Vendor → Shared events:
- Response submitted  

RFX scoring events are buyer-only.

AI assistance events:
- Allowed for shared clarifications  
- Forbidden for scoring  

---

# 13. Real-Time Notification Integration

The Collaboration Engine must trigger notifications for:

- Room messages  
- Mentions  
- Task updates  
- Document uploads  
- Architecture publications  
- RFX clarifications  
- RFX responses  
- ValueSphere shared updates  

Notifications must respect visibility (vendor_only, buyer_only, shared).

---

# 14. Transport Protocol Requirements

## 14.1 WebSocket Requirements
- JWT authentication at connection  
- Re-authentication on expiry  
- Room-scoped channel subscription  
- Graceful reconnect  
- Heartbeat pings  

## 14.2 SSE Requirements
- Token validation  
- Auto-retry  
- Event ID for resumability  

---

# 15. Permission Enforcement

EVERY event must pass through permission gating before broadcast.

Rules:

- Vendor-only events → vendor participants only  
- Buyer-only events → buyer participants only  
- Shared events → all participants  
- Ephemeral events must follow same visibility logic  

The engine must prevent:
- Vendor receiving buyer-only updates  
- Buyer receiving vendor-only updates  
- Guest receiving anything private  

User context:
- orgContext  
- suite entitlements  
- RoomParticipant role  
- panel visibility  

Codex must implement permission middleware in real-time layer.

---

# 16. Reliability & Ordering

## 16.1 Event Ordering
Ordering guaranteed within a Room channel, not globally.

## 16.2 Delivery Guarantees
- At-least-once for persistent events  
- At-most-once for ephemeral events  

## 16.3 Reconnect Behaviour
Upon reconnect:
- Query last known event ID  
- Resubscribe  
- Fetch missed events via REST fallback  

### 16.4 Event Replay and Offset Model

To support reliable reconnection and avoid missed state updates, the Collaboration Engine must implement a replay mechanism.

#### EventId Requirements
- Every persistent event must include a monotonically increasing `eventId` scoped to the room.
- Clients must store the highest `eventId` they have processed.

#### Reconnect Behaviour
When a client reconnects:
1. It sends the last received `eventId`.
2. The server returns all events with `eventId` greater than the provided value.
3. If the replay window has expired, the server instructs the client to fetch missing data via REST fallback endpoints.

#### Replay Window
- Minimum replay retention: 24 hours.
- Recommended: 3–7 days.
- Older events retrieved via RoomTimeline or other REST endpoints.

#### Consistency Guarantees
- Replayed events must maintain original ordering.
- Event delivery must not duplicate state changes on the client due to idempotent client-side handlers.


---

# 17. AI Integration in Collaboration

AI may:
- Summarise shared MAP  
- Suggest next tasks  
- Summarise shared messages  
- Suggest shared clarifications for RFX  
- Help write shared ValueSphere summaries  

AI must NOT:
- Use vendor-only or buyer-only context to generate shared updates  
- Reveal private work underway in draft vendor/buyer panels  

---

# 18. Observability & Logging

The engine must emit logs and metrics:

- Connection count  
- Channel membership  
- Event queue delays  
- Error logs  
- Permission denials  
- Throughput metrics  

AuditLog MUST record:
- Publishing events  
- MAP task updates  
- Document versioning events  
- RFX submissions  
- ValueSphere transitions  

---

# 19. Scalability Requirements

The engine must:

- Support thousands of concurrent Room channels  
- Scale horizontally  
- Partition events by Room  
- Use a message broker if necessary (Redis, NATS, Kafka)  
- Avoid cross-tenancy leakage  

Stateless WebSocket servers must share state via:
- Redis pub/sub  
- Distributed messaging  

---

# 20. Codex Implementation Rules

Codex MUST:

1. Implement WebSocket or SSE layer with full permission enforcement.  
2. Build client subscription logic per Room.  
3. Trigger UI updates when receiving events.  
4. Implement typing/presence indicators.  
5. Implement event retry logic.  
6. Integrate with Notifications system.  
7. Follow merge strategies for MAP and Architecture.  
8. Respect all vendor-only / buyer-only / shared visibility rules.  
9. Build event middleware to filter events by role.  
10. Use consistent event naming conventions.  
11. Never broadcast private events into shared channels.  
12. Log all persistent events in AuditLog.  

---

# 21. Summary

The Collaboration Engine is:

- The real-time core of Engagement Rooms  
- A structured, permission-aware event system  
- The foundation for shared MAP, messaging, ValueSphere, architecture, and RFX  
- The key for seamless multi-organisational collaboration  
- Designed with strict privacy, reliability, and scalability requirements  

This document defines the complete architecture required for Codex and engineering to build the real-time layer of Agama.

---

**End of collaboration_engine.md**
