# Repository structure

**Status:** Proposed. Nothing described under "Proposed layout" exists yet.

## What exists

The contents of the project repository were not inspected when this documentation was drafted. The only files this documentation set provides are:

```
README.md
docs/
  brand.md
  requirements.md
  architecture.md
  repository-structure.md
  engineering-standards.md
  development-workflow.md
  testing-strategy.md
  multi-tenancy-and-security.md
  roadmap.md
  decisions.md
```

Before merging, compare against the real repository and resolve any overlap with existing files. Do not overwrite existing work.

## Proposed layout (future, not created)

```
hun/
├── apps/
│   ├── api/                 NestJS modular monolith
│   │   ├── src/
│   │   │   ├── modules/     identity, tenancy, catalog, ordering, kitchen,
│   │   │   │                realtime, platform-admin, audit
│   │   │   ├── common/      guards, pipes, filters, tenant context
│   │   │   └── config/      typed, validated configuration
│   │   ├── prisma/          schema and migrations
│   │   └── test/            integration and tenant-isolation tests
│   └── web/                 React + Vite application
│       └── src/
│           ├── areas/       customer, dashboard, kitchen, admin
│           └── shared/      app-wide pieces used by several areas
├── packages/
│   ├── ui/                  design tokens and shared components
│   ├── contracts/           API types and validation schemas shared by api and web
│   └── config/              shared lint, formatting and TypeScript settings
├── e2e/                     end-to-end tests
├── docs/                    this documentation
├── .github/                 workflows, PR and issue templates
└── README.md
```

## Why this shape

| Choice | Reason |
| :-- | :-- |
| `apps/` and `packages/` | Conventional workspace split: deployables versus shared libraries |
| Modules under `apps/api/src/modules` | Directly mirrors the architecture; each folder is a boundary |
| `areas/` inside one web app | Lets the four experiences share a design system while staying independent; can be split into separate apps later |
| `packages/contracts` | One source for request/response types and validation, so API and web cannot silently disagree. Whether it is generated from OpenAPI or the reverse is undecided |
| `packages/ui` | Single home for brand tokens from [brand](brand.md); prevents hard-coded colours |
| Tests next to the code they test for unit tests, in `test/` for integration | Unit tests are found where the code is; heavier tests need their own setup |
| `e2e/` at the root | Spans API and web, so it belongs to neither |

## Module internals (proposed convention)

Each API module follows the same layout so that any module is navigable by someone who has seen one:

```
modules/ordering/
  ordering.module.ts
  ordering.controller.ts     HTTP boundary only: validation, auth guards, mapping
  ordering.service.ts        business rules and transactions
  ordering.repository.ts     tenant-scoped data access
  dto/                       request and response shapes
  ordering.public.ts         the only file other modules may import
```

## Tooling decisions that affect structure

| Decision | Leaning | Status |
| :-- | :-- | :-- |
| Package manager and workspaces | pnpm workspaces | Open |
| Build orchestration (Turborepo, Nx, none) | None at first | Open |
| Module boundary enforcement tool | To be selected | Open |

See [decisions](decisions.md).

## Rules

- Do not create a folder until there is something to put in it. Empty placeholder directories and stub files are not added.
- Generated files are not committed unless there is a stated reason.
- Anything that appears in this layout but does not exist must be described as proposed wherever it is mentioned.
