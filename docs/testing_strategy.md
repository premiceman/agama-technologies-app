# testing_strategy.md — Agama Technologies
Version: 1.0  
Status: Authoritative QA & Testing Specification

This document defines the test strategy for Agama:  
what to test, how to test it, and which critical cases MUST be covered.

---

## 1. Testing Levels

### 1.1 Unit Tests

- Cover:
  - Domain model logic (status transitions, validations)
  - Permission checks and visibility rules
  - Utility functions and helpers
  - AI context selection logic (what context is passed to AI)

- Aim:
  - Fast, deterministic
  - High coverage of business rules

### 1.2 Integration Tests

- Exercise:
  - API endpoints end-to-end with real DB (or realistic test DB)
  - Auth + org context
  - Room lifecycle
  - RFX flows
  - ValueSphere state machine
  - Invitation flows

- Include permission and role logic for each endpoint.

### 1.3 End-to-End (E2E) Tests

- Simulate real user flows:
  - Vendor onboarding → Account → Room → publish into shared.
  - Buyer onboarding → SourcingEvent → RFX → evaluation → decision.
  - Guest invite → join Room → collaboration on shared MAP and docs.
  - AI-suggested flow (for example summarising Room activity).

E2E tests must run against a staging environment.

---

## 2. Critical Test Suites

### 2.1 Permissions and Visibility

MUST cover:

- Vendor cannot see buyer-only content.
- Buyer cannot see vendor-only content.
- Guest can see only shared content.
- AI never uses disallowed context in outputs.

Cases:

- Direct API access attempts.
- UI-level access from wrong persona.
- AI requests in all modes.

### 2.2 Engagement Rooms

- Room creation from RevenueForge.
- Room participation changes (add/remove vendor and buyer users, guests).
- Shared MAP operations (create/update/complete tasks).
- Shared document uploads and versioning.
- Room lifecycle transitions including closed and archived.

### 2.3 RFX Workflows

- RFX draft authoring.
- RFX issuance.
- Vendor response submission and edits until deadline.
- Buyer scoring and evaluation.
- Clarification and amendment workflows.
- RFX closure and archival.

### 2.4 ValueSphere

- Template creation and versioning.
- Seller-mode, buyer-mode, shared-mode assessments.
- Scenario modelling and state transitions.
- Publish-to-shared mechanics.
- Access control by scope (seller/buyer/shared).

### 2.5 Search

- Permission-filtered search results:
  - Vendor sees only vendor-visible.
  - Buyer sees only buyer-visible.
  - Guest sees only shared.
- Search by entity type (Rooms, Accounts, Vendors, RFX, docs).
- Pagination and sorting.

---

## 3. AI Testing

AI tests must verify:

- Input context is correct for:
  - Vendor-only operations.
  - Buyer-only operations.
  - Shared operations.
- Outputs respect visibility boundaries.
- Proper behaviour when context is insufficient:
  - AI declines safely.
- No hallucination of restricted info in:
  - RFX scoring.
  - Vendor rankings.
  - Shortlist status.

Use a dedicated AI test harness that:

- Mocks different visibility contexts.
- Validates that outputs never contain flagged fields.

### 3.1 AI Adversarial Testing

Test cases must include:
- Attempts to coerce AI into revealing buyer-only or vendor-only data.
- Prompt-injection attempts inside messages, documents, or RFX responses.
- Manipulated context designed to mislead the AI engine.
- Attempts to infer private scoring or shortlist status indirectly.

The AI must:
- Decline
- Redact
- Or return a safe fallback response.


---

## 4. Load and Stress Testing

- Test real-time messaging at:
  - High message per second rates.
- Test RFX submissions under:
  - Many vendors.
  - Many questions.
- Test search with:
  - Large datasets.
  - Frequent queries.

Ensure:

- No catastrophic failures.
- Latency stays within budgets in `performance_and_scaling.md`.

---

## 5. Security Testing

### 5.1 Permission Fuzzing

- Random user and role combinations hitting:
  - Org endpoints
  - Room endpoints
  - RFX endpoints
  - ValueSphere endpoints

Test ensures:

- 403 where expected.
- No data leakage in error messages.

### 5.2 Injection Testing

- Inputs must be safely handled in:
  - Messages
  - Document names
  - RFX questions and answers
  - ValueSphere narratives

Verify:

- No script execution.
- No query injection.

### 5.3 Invite and Token Tests

- Invite tokens cannot be reused.
- Expired invites rejected.
- Guest tokens cannot be used for internal user flows.

---

## 6. Automation and CI

- All unit and integration tests must run in CI on every branch.
- E2E tests must run:
  - On main branch regularly.
  - Before major releases.
- Performance tests must run on schedule or on demand before large deployments.

Test runs must:

- Fail build on regression.
- Report coverage and highlight untested critical areas.

---

## 7. Summary

This document defines the mandatory testing strategy for Agama.  
Any new feature must:

1. Be mapped to this testing framework.  
2. Add or update test cases accordingly.  
3. Only be considered complete when all relevant tests are passing.

