# hun.

**A universal, multi-tenant restaurant and café management and ordering system.**

One shared platform. Many independent restaurants and cafés. Each with its own workspace, menu, branches, staff, orders and data, configured rather than forked.

> **Status: MVP in progress.** The ordering and payment workflow described in [Requirements](docs/requirements.md) is implemented: a React + TypeScript + Vite customer menu, cart and checkout, orders persisted in Supabase through server-priced RPCs with RLS, a customer tracking page, and a staff sign-in with a live order queue, payment verification and menu management. The rest of this document — multi-restaurant administration, kitchen display, CI — remains **proposed**. See [Current status](#current-status).
>
> hun. is a café on Bole Road, Addis Ababa, opened in 2026 by Hanan Seid. Its menu, prices and story live in the app; the platform around it is the product.

---

## Contents

| Document | Purpose |
| :-- | :-- |
| [Brand and design system](docs/brand.md) | Wordmark, palette, typography, contrast rules, how the identity applies to docs and UI |
| [Photography](docs/photography.md) | Which photograph illustrates which dish, sources and licences |
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

**Explicitly out of scope for the MVP:** delivery and courier logistics, inventory, supplier management, expenses, reservations, analytics dashboards, native mobile apps, marketplace-style cross-restaurant search and ranking.

Payments are in scope: the customer chooses Telebirr, CBE Birr, CBE, Awash, Bank of Abyssinia, Dashen, M-Pesa or cash, transfers the exact amount, then submits the transaction number. Staff match it against the merchant account and accept or decline it before the kitchen starts. No card data is handled and no payment provider is integrated yet.

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
| Ordering workflow (customer → kitchen → status) | Implemented and verified locally against Supabase |
| Payments (Telebirr, CBE Birr, CBE, Awash, Abyssinia, Dashen, M-Pesa, cash) | Implemented as transfer-and-verify, verified locally; provider integration not started |
| Staff management (order queue, payment verification, menu availability and prices, today's numbers) | Implemented |
| Application code | React + TypeScript + Vite in `src/` |
| Database | SQL migrations and seed in `supabase/migrations/`, applied with the Supabase CLI |
| Docker, CI | Not configured; Docker is used only by the local Supabase stack |
| Market validation | None performed |

These documents were drafted without access to the contents of the project repository. Before merging them, check them against what the repository already contains and update the status table above accordingly.

---

## Running locally

The MVP needs Node 20+, the Supabase CLI and Docker.

```bash
npm install
supabase start          # first run downloads the local stack
supabase db reset       # applies supabase/migrations and the seed
cp .env.example .env.local   # then paste the local URL and anon key
npm run dev             # http://127.0.0.1:5174
```

`.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, both from
`supabase status -o env` (`API_URL` and `ANON_KEY`). Only the publishable anon
key ever reaches the browser; the service-role key stays in the dashboard.

- Menu, cart, checkout and order tracking: open the app.
- Staff side: `/signin` with the seeded demo account `owner@hun.test` /
  `hun-demo-2026`, then `/dashboard` for the order queue, payment verification,
  today's numbers and the editable menu. That hint only appears in a local dev
  build; change or delete the seeded account before anyone real signs in.
- Checks: `npm run typecheck`, `npm test`, `npm run build`,
  `node scripts/verify-payments.mjs`, `node scripts/verify-management.mjs` (the
  last two need the local Supabase stack running).

---

## Deploying

The app is a static Vite build; the data lives in Supabase.

1. **Database.** Create the project, then apply `supabase/migrations` in order
   (`0001` … `0005`) either with `supabase db push` against the linked project or
   by pasting the files into the SQL Editor. `0004_seed.sql` seeds the café, its
   menu and a demo owner — run it once, then replace the demo account.
2. **Payment details.** In `payment_methods`, replace the placeholder Telebirr
   and bank account numbers with the café's own before accepting a real payment,
   and set `payments_sandbox = false` on the restaurant.
3. **Frontend.** Build with `npm run build` (output `dist/`), set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the build environment,
   and serve `dist/` on any static host. `public/_redirects` gives the SPA its
   route fallback on Netlify and Cloudflare Pages; other hosts need the same
   rewrite to `/index.html`.
4. **Secrets.** Only the publishable anon key belongs in the build. The
   service-role key stays server-side and is never used by this app.

Photographs are credited in [docs/photography.md](docs/photography.md); the stock
set should be replaced with photographs of the real room before launch.

---

## Conventions used in these documents

- Requirement IDs: `FR-###` (functional), `NFR-###` (non-functional). Roadmap acceptance criteria reference them.
- Priority: **Must**, **Should**, **Could** (MoSCoW).
- Document status labels: **Proposed**, **Accepted**, **Superseded**.
- Statements about the future use "proposed" or "will"; statements about the present describe only what exists.
- Colours, fonts and layout apply as far as the renderer allows. Markdown carries the identity through naming, headings and tables, not through guaranteed typography.
