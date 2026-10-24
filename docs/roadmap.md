# Roadmap

**Status:** Proposed. All milestones are **not started**. No dates are given: sequencing and acceptance criteria matter more than guesses at duration, and estimates should be added after the first milestone gives a measured pace.

Each milestone ends in something demonstrable. A milestone is complete only when every acceptance criterion has been verified, not when the work is merely coded. Requirement IDs refer to [requirements](requirements.md).

## Overview

| # | Milestone | Outcome | Depends on | Status |
| :-: | :-- | :-- | :-- | :-- |
| M0 | Foundations | Decisions confirmed, repository ready for work | None | Not started |
| M1 | Tenancy and identity | Restaurants, staff and roles, with proven isolation | M0 | Not started |
| M2 | Menu management | Restaurants can build and maintain menus | M1 | Not started |
| M3 | Order creation | Customers can place correct, duplicate-safe orders | M2 | Not started |
| M4 | Order handling and kitchen | Staff and kitchen process orders with real-time updates | M3 | Not started |
| M5 | Customer tracking and end-to-end | The full ordering workflow works across all surfaces | M4 | Not started |
| M6 | Hardening and pilot readiness | Safe to put in front of one real restaurant | M5 | Not started |

M5 completes the first major functional goal. After M6, direction depends on evidence from the pilot, not on this document.

## M0. Foundations

**Deliverables**

- Open decisions in [decisions](decisions.md) resolved or consciously deferred: monorepo and tooling, data access approach, row-level security, authentication, front-end structure, test runners.
- Threat-modelling session for tenancy and authentication, recorded in the security document.
- Repository scaffolded according to the accepted structure; CI running lint, type check and an empty test suite; development environment documented.
- Design tokens from [brand](brand.md) defined once.

**Acceptance criteria**

- Every ADR needed for M1 has status Accepted.
- A new contributor can clone the repository and run lint, type check and tests following the README alone.
- CI runs on a pull request and blocks on failure (demonstrated with a deliberately failing branch).
- The README status table matches reality.

## M1. Tenancy and identity

**Deliverables:** restaurant creation by a platform admin (FR-001, FR-002), owner sign-in, staff invitation and deactivation (FR-010, FR-011), roles, branches and tables (FR-012, FR-014), restaurant settings (FR-015), audit records for these actions (FR-003), the shared two-tenant test helper.

**Acceptance criteria**

- All endpoints deny by default; an unauthenticated request to any non-public route is refused (NFR-002).
- Tenant isolation tests exist for every tenant-owned resource and pass (NFR-001); a deliberately introduced missing filter causes a test to fail.
- A deactivated user's next request is refused (FR-011).
- Passwords hashed per standards; rate limiting verified by test (NFR-003).
- No secrets in the repository; configuration validated at start-up (NFR-004).
- OpenAPI description generated and published for the implemented endpoints.

## M2. Menu management

**Deliverables:** categories, items, option groups, availability per branch, archiving (FR-020 to FR-024); a public read endpoint for a restaurant's menu; dashboard screens for menu management using the shared design system.

**Acceptance criteria**

- A manager can create, edit, reorder and archive menu content; changes appear in the public menu.
- A staff member cannot change prices; a manager of restaurant A cannot see or edit restaurant B's menu (isolation tests).
- Prices are stored as integer minor units; no floating-point money anywhere (NFR-005).
- Archived items do not appear in the public menu but remain referenced by existing data.
- Accessibility check of the dashboard screens passes at the agreed level (NFR-012).

## M3. Order creation

**Deliverables:** public order endpoint with idempotency (FR-030, FR-032 to FR-035), server-side pricing, order and status-event creation in one transaction, tracking token, customer ordering flow in the web app, dine-in table identification (FR-031) if time permits.

**Acceptance criteria**

- Placing an order with a valid cart creates exactly one order with correct server-computed totals.
- Submitting the same idempotency key repeatedly, including concurrently, yields one order (FR-034, NFR-010); verified by an automated concurrency test.
- Tampered prices or totals in the request have no effect (FR-033).
- Orders for suspended restaurants or unavailable items are refused with the standard error shape.
- Editing the menu afterwards does not change existing orders (FR-035).
- Order creation and its initial status event are atomic (forced-failure test).

## M4. Order handling and kitchen

**Deliverables:** order state machine (FR-041), accept and reject (FR-040), kitchen display (FR-042, FR-043), status history (FR-044), optimistic concurrency (FR-045), authenticated Socket.IO gateway with branch rooms, recovery after reconnect (FR-046), order history (FR-047, Should).

**Acceptance criteria**

- Every illegal transition is refused; every legal transition is recorded with actor and time.
- Two simultaneous conflicting updates result in one success and one conflict response.
- A new order appears on staff and kitchen screens of the right branch only, without refresh; users of another branch or restaurant receive nothing (isolation tests for real time).
- After disconnecting and reconnecting, the kitchen display shows correct current state.
- Kitchen display reviewed for legibility and target size on a real device at distance (NFR-013).

## M5. Customer tracking and end-to-end

**Deliverables:** customer order-tracking view with live updates (FR-036), cancellation before acceptance (FR-037, Should), consistent look and behaviour across all four surfaces, the end-to-end journeys in [testing strategy](testing-strategy.md#end-to-end-journeys-mvp) automated.

**Acceptance criteria**

- The five end-to-end journeys pass in CI.
- A customer sees every status change of their order without refreshing, and sees the rejection reason when rejected.
- Tracking tokens cannot be used to read any other order; guessing attempts are rate limited.
- A demonstration walkthrough from onboarding a restaurant to completed order works on a fresh environment.
- README and status tables are updated to reflect what is verified, and nothing more.

**Milestone M5 is the end of the first major functional goal.**

## M6. Hardening and pilot readiness

**Deliverables:** backup and tested restore (NFR-017), structured logging and basic monitoring (NFR-015), dependency and secret scanning, security review of tenancy and authentication against the threat model, baseline load test to set performance targets (NFR-011, NFR-009), privacy and retention decisions, a deployed staging environment, a documented release and rollback procedure, platform-admin MFA.

**Acceptance criteria**

- A restore from backup has been performed and verified.
- A security review has been completed and every high-severity finding is fixed or explicitly accepted in writing.
- Measured latency and capacity numbers replace the placeholders in the requirements.
- A pilot restaurant can be onboarded by following written steps, without developer intervention in the database.
- Known limitations are listed honestly in the README.

## Beyond M6 (candidates, not commitments)

Chosen using pilot evidence: online payments, delivery workflow, reservations, inventory and suppliers, expenses, analytics, restaurant discovery across tenants, customer accounts, multi-language menus, deeper multi-branch management.

## Risks to the plan

| Risk | Response |
| :-- | :-- |
| Decisions in M0 take longer than expected | Time-box; record unresolved items as risks and proceed with the safest default |
| Row-level security proves impractical with the data layer | Fall back to application-level scoping with stronger tests, recorded as an ADR |
| Scope growth from "nice to have" features | Anything not in the MVP list needs a requirement and a reason before entering a milestone |
| Real-time complexity | Polling fallback behind the same publishing interface |
| Single maintainer | Keep the plan small; document decisions so work can resume after any gap |
