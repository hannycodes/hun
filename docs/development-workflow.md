# Development workflow

**Status:** Proposed. GitHub settings, templates and automation described here have not been created.

## Principles

- Small, verifiable increments: each change should be reviewable in one sitting.
- `main` is always in a working state.
- Every change is traceable from an issue to a pull request to a merge.
- Working alone does not remove the process. Self-review against the checklist below stands in for a second reviewer until there is one.

## Issues

- One issue describes one outcome that can be verified.
- Each issue states: the goal, the relevant requirement IDs (for example FR-034), acceptance criteria written as checkable statements, and out-of-scope items.
- Issues larger than a few days of work are split.
- Labels (proposed): `type:feature`, `type:bug`, `type:docs`, `type:chore`, `area:<module>`, `security`, `blocked`.
- Milestones map to the [roadmap](roadmap.md).

## Branches

- `main` is protected: no direct pushes, pull request required, CI must pass.
- Short-lived branches from `main`, merged back within days.
- Naming: `<type>/<issue-number>-<short-description>`, for example `feat/42-order-idempotency`, `fix/57-kitchen-reconnect`, `docs/12-roadmap`.
- Rebase or merge `main` into the branch before review so CI runs on current code.

## Commits

Conventional Commits:

```
<type>(<scope>): <summary in the imperative, under about 72 characters>

<optional body: what and why, not how>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`. Scope is the module or area (`ordering`, `kitchen`, `web`). Reference the issue in the body or footer. Commits are focused; avoid mixing unrelated changes.

## Pull requests

Each pull request should:

- Link its issue and state what changed and why.
- Stay small and focused; split refactors from behaviour changes.
- Include tests and documentation updates.
- Include screenshots or recordings for interface changes.
- Call out security-relevant changes, migrations and anything reviewers should check carefully.

Proposed template checklist:

```
- [ ] Linked issue and requirement IDs
- [ ] Acceptance criteria met and verified
- [ ] Tests added or updated; tenant-isolation test if tenant data is touched
- [ ] Authorization checked on every new endpoint or channel
- [ ] Input validation and error handling covered
- [ ] No secrets or personal data in code, logs or fixtures
- [ ] Migration reviewed (if any)
- [ ] Documentation and status updated
```

Merge method: squash merge, with the pull request title as a Conventional Commit message.

## Code review

Reviewers check, in this order:

1. **Correctness and requirements:** does it do what the issue says, and only that?
2. **Security and tenant isolation:** is every access scoped and authorized?
3. **Data integrity:** transactions, constraints, idempotency, concurrency.
4. **Tests:** do they prove the behaviour and the failure cases?
5. **Design:** module boundaries respected, simplest adequate solution.
6. **Readability and documentation.**

Review comments are specific and kind. The author responds to every comment. Approval means the reviewer would be comfortable being on call for this change.

## Continuous integration (proposed)

On every pull request: install with the lockfile, type check, lint and format check, unit tests, integration tests against a real PostgreSQL, build, dependency audit. End-to-end tests run on pull requests that touch affected areas and always before release. A red build blocks merging.

## Releases

Not defined yet. Until there is a deployed environment, `main` is the only line of development. Versioning, environments and deployment are to be decided before the first pilot ([roadmap](roadmap.md)).

## Documentation changes

Documentation follows the same flow: branch, pull request, review. Documents are kept short and are updated, not duplicated. Decisions go in [decisions](decisions.md).
