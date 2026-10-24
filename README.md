# hun.

**A universal, multi-tenant restaurant and café management and ordering system.**

One shared platform. Many independent restaurants and cafés. Each with its own workspace, menu, branches, staff, orders and data, configured rather than forked.

> **Status: documentation phase.** This folder contains planning documents only. No application code, scaffolding, database, container or CI configuration is described here as existing. Everything about the technical stack is **proposed**. See [Current status](#current-status).

---

## Contents

| Document | Purpose |
| :-- | :-- |
| [Brand and design system](docs/brand.md) | Wordmark, palette, typography, contrast rules, how the identity applies to docs and UI |
| [Requirements](docs/requirements.md) | Functional and non-functional requirements with IDs and priorities |
| [Architecture](docs/architecture.md) | Proposed components, interactions, data flow, trade-offs |
| [Repository structure](docs/repository-structure.md) | Proposed future layout, clearly separated from what exists |
| [Engineering standards](docs/engineering-standards.md) | Code quality, maintainability, security and data-integrity expectations |
| [Development workflow](docs/development-workflow.md) | Issues, branches, commits, pull requests, review |
| [Testing strategy](docs/testing-strategy.md) | Unit, integration and end-to-end testing; mandatory tenant-isolation tests |
| [Multi-tenancy and security](docs/multi-tenancy-and-security.md) | Tenant isolation, backend authorization, roles, data protection |
| [Roadmap](docs/roadmap.md) | Incremental milestones with deliverables, dependencies, acceptance criteria |
| [Architecture decisions](docs/decisions.md) | Decision records, alternatives considered, open questions |

Suggested reading order for a new engineer: this README, Requirements, Architecture, Multi-tenancy and security, Roadmap.

---

## Product

hun connects four experiences on one platform:

1. **Customer**: discover a restaurant, browse its menu, place an order, track it.
2. **Restaurant dashboard**: manage menus, orders, staff, branches, tables and day-to-day operations.
3. **Kitchen display**: see incoming orders, work the preparation queue, update status in real time.
4. **Platform administration**: onboard restaurants, configure the platform, oversee operations.

The first major functional goal is a working **end-to-end ordering workflow**: a customer creates an order, the restaurant and kitchen process it, and the customer sees status updates.

### Possible later capabilities (not commitments)

Inventory, suppliers, expenses, reservations, delivery workflows, analytics, richer multi-branch management. These are explored only after the ordering workflow is proven.

---

## Philosophy

- Thoughtful functionality over feature count.
- Beautiful, consistent interfaces without sacrificing usability.
- Real engineering fundamentals over superficial, generated-looking code.
- Maintainable architecture over unnecessary complexity.
- Strong security and tenant isolation from the beginning, not retrofitted.
- Small, verifiable increments of work.
- Honest documentation of what is complete, planned and incomplete.
- Decisions informed by both the founder's vision and evidence gathered during development.
- One cohesive experience across customer, restaurant, kitchen and administrative interfaces.

hun is a product shaped by its founder's taste as well as by its market. Commercial viability matters. So do craft, design quality and genuine interest in the work. No market validation has been performed yet; see the open questions in [decisions](docs/decisions.md#open-questions).

---

## Scope of the first release

**In scope (MVP, the ordering workflow):** restaurant workspaces, staff accounts and roles, one or more branches, menu management, customer order creation (dine-in and pickup), restaurant order handling, kitchen display, real-time status updates, customer order tracking, a minimal platform-admin surface for onboarding restaurants.

**Explicitly out of scope for the MVP:** online payment processing, delivery and courier logistics, inventory, supplier management, expenses, reservations, analytics dashboards, native mobile apps, marketplace-style cross-restaurant search and ranking.

Details and priorities are in [Requirements](docs/requirements.md).

---

## Proposed technical direction

Proposed, not implemented, and subject to the decisions recorded in [decisions](docs/decisions.md):

| Area | Proposal |
| :-- | :-- |
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, TypeScript, NestJS, as a **modular monolith** |
| Database | PostgreSQL, accessed through Prisma |
| Real time | Socket.IO, used for notifications; the REST API remains the source of truth |
| API contract | REST described with OpenAPI |
| Quality | Automated tests, continuous integration with GitHub Actions |
| Packaging | Docker where it helps; not assumed everywhere |
| Repository | Single monorepo (to be confirmed) |

---

## Current status

| Area | State |
| :-- | :-- |
| Product vision and scope | Drafted in this documentation set |
| Requirements | Drafted, unreviewed |
| Architecture | Proposed, unvalidated by any prototype |
| Technology choices | Proposed; several decisions still open |
| Application code | Not part of this documentation set |
| Database, Docker, CI | Not configured by this documentation set |
| Market validation | None performed |

These documents were drafted without access to the contents of the project repository. Before merging them, check them against what the repository already contains and update the status table above accordingly.

---

## Conventions used in these documents

- Requirement IDs: `FR-###` (functional), `NFR-###` (non-functional). Roadmap acceptance criteria reference them.
- Priority: **Must**, **Should**, **Could** (MoSCoW).
- Document status labels: **Proposed**, **Accepted**, **Superseded**.
- Statements about the future use "proposed" or "will"; statements about the present describe only what exists.
- Colours, fonts and layout apply as far as the renderer allows. Markdown carries the identity through naming, headings and tables, not through guaranteed typography.
