# search_architecture.md — Agama Technologies

Version: 1.0  
Owner: Agama Technologies  
Status: Authoritative Search & Indexing Specification  
Last Updated: (update before commit)

This document defines Agama’s complete search and filtering architecture, including data indexing, permissions, rank scoring, entity summarisation, AI integration, UI patterns, and Codex implementation rules.

Search is a core platform feature enabling users to quickly find:
- Accounts  
- Vendors  
- RFX items  
- Room messages  
- Stakeholders  
- ValueSphere assessments  
- Documents  
- Procurement events  
- Tasks  
- Architecture items  

Search MUST always respect all suite entitlements, persona restrictions, Room context, and visibility modes (`vendor_only`, `buyer_only`, `shared`).

---

# 1. Purpose of Search

Agama’s search engine serves these core goals:

1. Provide **fast, cross-entity discovery** for every object in the platform.  
2. Support **structured filtering** for buyer and vendor workflows.  
3. Integrate with the **AI layer** to provide semantic and contextual results.  
4. Enforce strict **permission and visibility boundaries**.  
5. Offer a unified search experience across RevenueForge, ProcurePath, Engagement Rooms, ValueSphere, and RFX.  
6. Guarantee **enterprise-grade performance, accuracy, and data governance**.

---

# 2. Two-Phase Architecture

Agama search runs in two phases:

## 2.1 Phase 1 — MongoDB Native Search (MVP)
Uses:
- Text indexes  
- Index-backed filtering  
- Full-text `$text` queries  
- `$search` (if Atlas Search available)  

Supports:
- Title and body text search  
- Keyword search  
- Permission-filtered queries  
- Pagination  

Used initially to avoid early complexity.

## 2.2 Phase 2 — OpenSearch / Elastic (Enterprise Grade)
Adds:
- Semantic vector search  
- Weighted ranking  
- Fuzzy search  
- Synonyms  
- Highlighting  
- Advanced filters  
- AI-driven scoring  
- Real-time indexing  

This phase integrates deep semantic search across large document sets (RFX responses, ValueSphere text, architecture notes, Gong transcripts, etc.).

---

# 3. Indexable Entities

Each entity type in Agama must define:

- Textual fields  
- Metadata fields  
- Permission scope  
- Visibility scope  

Below are the entities that MUST be included.

## 3.1 AgamaAccount
Index fields:
- Name  
- Domain  
- Stakeholder names  
- Qualification summaries (shared/vendor-only for vendor searches)  
- Notes (respecting visibility)  
- Metadata tags  

Filters:
- Owner  
- Industry  
- Region  
- Health score  

## 3.2 VendorRecord (Buyer Side)
Index fields:
- Vendor name  
- Domain category  
- Risk summary  
- Past performance  
- Summary of RFX responses (buyer-only)  

Visibility:
- Buyer users only  

## 3.3 SourcingEvent
Index fields:
- Name  
- Description  
- Phase  
- Vendor names  

Filters:
- Status  
- Budget  
- Owner  

Visibility:
- Buyer suite only

## 3.4 EngagementRoom
Index fields:
- Room name  
- Vendor account name  
- Buyer vendor record name  
- Shared descriptions  

Filters:
- Status  
- User participation  

Visibility:
- Only for users who are Room participants  

## 3.5 RoomMessage
Index fields:
- Message content  
- Thread context  

Filters:
- Room  
- Mention  

Visibility:
- Based on RoomParticipant role  
- Never index vendor-only or buyer-only notes  

## 3.6 RoomDocument and Versions
Index fields:
- Document name  
- Version summaries  
- Document body (if plaintext extraction available)  

Visibility:
- Shared docs only  

## 3.7 Rfx, RfxSection, RfxQuestion
Index fields:
- RFX topic  
- Section titles  
- Question texts  
- Tags  

Visibility:
- Vendors can search only issued RFX questions relevant to them  
- Buyers can search all RFX content in their org  

## 3.8 RfxResponse
Index fields:
- Vendor answer text  
- Attachment metadata  
- Tags  

Visibility:
- Vendor can search their own responses  
- Buyer can search responses from all vendors for that RFX  
- No vendor can see other vendors’ responses  

## 3.9 ValueAssessments
Index fields:
- Section names  
- Question labels  
- Summary narratives  
- Metrics  

Visibility:
- Vendor-only, buyer-only, or shared, depending on assessment mode  

## 3.10 Tasks (Shared + Internal)
Index fields:
- Title  
- Description  

Visibility:
- Shared tasks → everyone  
- Vendor-only tasks → vendor only  
- Buyer-only tasks → buyer only  

## 3.11 Stakeholders
Index fields:
- Name  
- Job title  
- Notes (vendor-only)  

Visibility:
- Vendor-only stakeholder data  
- Buyer stakeholders separate  

---

# 4. Permission Enforcement

Search must filter at **query time** and **result time**.

## 4.1 Query-Time Filtering
Query must include:
- `orgId` filter for tenant isolation  
- Role filters (vendor, buyer, guest)  
- Suite entitlements  
- Room participation filter (if searching Room content)  
- Visibility filters (`shared`, `vendor_only`, `buyer_only`)

## 4.2 Result-Time Filtering
Before returning results:
- Validate visibility again  
- Remove fields not visible to requester  
- Remove entire entries if user lacks scope  

Example:
- Buyer searching RfxResponse sees all vendor answers  
- Vendor sees only their answers  
- Buyer-internal scoring fields are always removed  

---

# 5. Indexing Model (Phase 2: OpenSearch/Elastic)

For enterprise scale, Agama uses a hybrid indexing model.

## 5.1 Index Structure
Each entity maps to a dedicated index:

- agama_accounts  
- vendor_records  
- sourcing_events  
- engagement_rooms  
- room_messages  
- room_documents  
- rfx  
- rfx_responses  
- valuesphere  
- tasks  
- stakeholders  

All indexes include:
- `orgId`  
- `visibility`  
- `entityType`  
- `updatedAt`  
- `ownerIds`, `participantIds` where applicable  

## 5.2 Text Analysis
Use:
- Standard analyzer  
- N-grams for partial matching  
- Keyword analyzer for IDs  
- Custom analyzers for:
  - RFX question prompts  
  - ValueSphere narrative  
  - Document extraction outputs  

## 5.3 Reindexing Strategy
- Full rebuild on template changes  
- Incremental updates on document changes  
- Event-driven indexing on Room activity  

---

# 6. Semantic Search (Phase 2)

Agama must support semantic similarity search using vector embeddings.

## 6.1 Use Cases
- Searching RFX questions semantically  
- Searching ValueSphere content  
- Searching shared architecture notes  
- Searching Gong transcript text  
- Searching large sets of vendor responses  

## 6.2 Embeddings
Embeddings generated from:
- Question prompts  
- Vendor responses  
- Shared ValueSphere summaries  
- Architecture comments  
- Stakeholder notes (vendor-only)  

Visibility constraints apply BEFORE embedding content is used.

Embeddings must NEVER leak:
- Vendor-only data to buyers  
- Buyer-only data to vendors  

Thus:
- Vendor-only embeddings → vendor-only index  
- Buyer-only embeddings → buyer-only index  
- Shared embeddings → shared index  

---

# 7. Query Parsing & Ranking

## 7.1 Query Parsing Steps
1. Normalize text  
2. Expand synonyms (e.g., “contract” → “SOW”, “agreement”)  
3. Identify entity-specific tokens  
4. Apply role-based filters  
5. Construct hybrid query (text + metadata filters)

## 7.2 Ranking Rules
Weight components:
- Textual relevance  
- Context entityType weighting (Room > Messages > Docs > RFX questions)  
- Recency  
- Role relevance  
- AI relevance score (semantic similarity)  
- Engagement metrics (e.g., frequently accessed rooms)  

---

# 8. Search UI & UX Specifications

The search UI must feel universal across the platform.

## 8.1 Global Search Bar
Appears in:
- Top navigation of every screen  
- Returns cross-entity results  

## 8.2 Entity Filters
Filter by:
- Rooms  
- Accounts / Vendors  
- RFX / Questions / Sections  
- ValueSphere Assessments  
- Documents  
- Messages  
- Stakeholders  
- Domain (buyer mode)  

## 8.3 Result Cards
Each result must display:
- Title  
- Subtitle (entity type)  
- Snippet (highlighted text)  
- Timestamp  
- Theme-based styling  
- Quick actions (“Open Room”, “Open Account”, “Open RFX”, etc.)  

## 8.4 Scoped Searches
When inside:
- RevenueForge → search is vendor-only scoped  
- ProcurePath → search is buyer-only scoped  
- Engagement Rooms → search is Room-scoped by default  
- ValueSphere → search includes assessments and scenarios  

Scope can be expanded by the user if allowed.

---

# 9. AI-Assisted Search

AI may assist in:

- Semantic ranking  
- Auto-detection of entity type  
- Query rewriting (expanding acronyms, synonyms)  
- Generating contextual snippets  
- Detecting “intent” (e.g., user types “security”) to prioritise risk docs  

AI must NOT:
- Use buyer-only signals to rank vendor results  
- Use vendor-only signals to rank buyer results  
- Reveal private content in snippets  

---

# 10. Integration With Other Systems

## 10.1 RevenueForge
Supports:
- Searching accounts  
- Searching qualification  
- Searching stakeholders  
- Searching vendor-only notes  

## 10.2 ProcurePath
Supports:
- Searching vendors by domain  
- Searching risk items  
- Searching RFX  
- Searching responses  
- Searching approvals  

Buyer-only content must remain hidden from vendors.

## 10.3 Engagement Rooms
Supports searching:
- Room messages  
- Shared MAP items  
- Shared documents  
- Shared ValueSphere  
- Room participants  
- RFX questions/clarifications  
- Vendor responses (only vendor’s own)  

## 10.4 ValueSphere
Searches:
- Question labels  
- Scenario summaries  
- Shared assumptions  
- Narrative text  

---

# 11. Codex Implementation Requirements

Codex MUST:

1. Implement Phase 1 using MongoDB text indexes.  
2. Prepare codebase for easy Phase 2 expansion (OpenSearch).  
3. Apply permission filters at query-time and result-time.  
4. Never serve buyer-only or vendor-only content across boundaries.  
5. Always include `orgId` filters.  
6. Implement entity-specific ranking rules.  
7. Build the universal search UI exactly as defined.  
8. Include search analytics hooks (for future ML tuning).  
9. Ensure consistent theming (seller/buyer/shared).  
10. Use skeleton loaders for search result pages.  
11. Support Room-scoped search context.  

---

# 12. Failure Handling & Fallbacks

When search providers fail (Mongo or OpenSearch):

Fallback rules:
1. Attempt retry with exponential backoff.
2. If OpenSearch fails:
   - Fall back to Mongo full-text search.
3. If Mongo full-text fails:
   - Fall back to title-only substring search.
4. Always return a gracefully degraded result set.
5. Display a warning banner indicating reduced search quality.

Failures must NEVER:
- Leak internal error messages to vendors or buyers
- Reveal stack traces
- Block the user experience

# 13. AI Ranking Constraints

AI-assisted ranking must obey visibility rules:

- Vendor user → ranking can use vendor-only + shared embeddings
- Buyer user → ranking can use buyer-only + shared embeddings
- Guest → ranking uses shared embeddings only

AI may:
- Promote results more relevant to the query intent
- Down-rank stale or low-quality items

AI may NOT:
- Rank vendors based on buyer-internal scoring
- Rank buyers based on vendor-internal qualification
- Mix embeddings from incompatible visibility scopes

---

# 14. Room-Level Search Visibility

Room-scoped search must:
- Return only shared items for guests
- Return vendor_only + shared items for vendor users
- Return buyer_only + shared items for buyer users

Search indexing must store:
- visibility: vendor_only | buyer_only | shared

Search queries must filter by:
- roomId
- visibility
- user role

---

# 15. Summary

This document defines the complete search architecture for Agama, covering:

- Data models  
- Index structures  
- Permission enforcement  
- Semantic search  
- Ranking rules  
- UI/UX  
- Phase 1 and Phase 2 technical plans  
- Integration with all product surfaces  
- AI augmentation rules  
- Codex implementation requirements  

Search is a central productivity driver across the entire platform and must be built to enterprise-grade standards.

---

**End of search_architecture.md**
