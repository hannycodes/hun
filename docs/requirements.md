# Requirements

**Status:** Proposed, unreviewed. Priorities: **Must**, **Should**, **Could**. "MVP" means the first end-to-end ordering workflow.

## Terms

| Term | Meaning |
| :-- | :-- |
| Restaurant | A tenant: one independent restaurant or café business and its workspace |
| Branch | A physical location belonging to exactly one restaurant |
| Menu | A restaurant's catalogue of categories, items, options and prices; may be assigned to branches |
| Order | A customer's request for items from one branch of one restaurant |
| Staff | A person with an account in one restaurant's workspace |
| Platform admin | A hun operator with cross-tenant administrative access |

## Actors and roles

`platform_admin`, `restaurant_owner`, `manager`, `staff` (front of house/cashier), `kitchen`, and `customer` (guest or registered). Permissions are defined in [multi-tenancy and security](multi-tenancy-and-security.md#roles-and-permissions).

## Functional requirements

### Platform administration

| ID | Requirement | Priority |
| :-- | :-- | :-- |
| FR-001 | A platform admin can create a restaurant workspace and its first owner account | Must |
| FR-002 | A platform admin can suspend and reactivate a restaurant; suspended restaurants cannot take orders | Must |
| FR-003 | Platform-admin actions on tenant data are audit-logged | Must |
| FR-004 | A platform admin can view restaurant list and basic operational status | Should |

### Restaurant workspace and staff

| ID | Requirement | Priority |
| :-- | :-- | :-- |
| FR-010 | An owner can invite staff by email and assign a role | Must |
| FR-011 | Owners and managers can deactivate staff; deactivated users lose access immediately | Must |
| FR-012 | A restaurant can have one or more branches, each with name, address, opening hours and timezone | Must |
| FR-013 | Staff and kitchen users can be limited to specific branches | Should |
| FR-014 | A restaurant can define tables (dine-in) per branch | Must |
| FR-015 | Restaurant-level configuration (currency, order types enabled, ordering on/off) without code changes | Must |

### Menu

| ID | Requirement | Priority |
| :-- | :-- | :-- |
| FR-020 | Managers can create, edit, reorder and archive categories and items | Must |
| FR-021 | Items have name, description, price, optional image, and availability | Must |
| FR-022 | Items support option groups (for example size, add-ons) with price adjustments and required/optional rules | Should |
| FR-023 | Items can be marked unavailable per branch without deleting them | Must |
| FR-024 | Archived items remain visible on historical orders | Must |
| FR-025 | Multiple languages for menu content | Could |

### Customer ordering

| ID | Requirement | Priority |
| :-- | :-- | :-- |
| FR-030 | A customer can open a restaurant's public menu without an account | Must |
| FR-031 | A customer can scan a table identifier (for example a QR code) to start a dine-in order at that table | Should |
| FR-032 | A customer can build a cart and place an order for dine-in or pickup | Must |
| FR-033 | The server computes all prices and totals from current menu data; client-supplied prices are ignored | Must |
| FR-034 | Placing an order is idempotent: retries and double submissions create at most one order | Must |
| FR-035 | An order records a snapshot of item names, options and prices as ordered | Must |
| FR-036 | A customer can see their order's status and updates without refreshing | Must |
| FR-037 | A customer can cancel an order until the restaurant accepts it | Should |
| FR-038 | Restaurant discovery across restaurants (search, browse) | Could |
| FR-039 | Registered customer accounts and order history | Could |

### Order handling and kitchen

| ID | Requirement | Priority |
| :-- | :-- | :-- |
| FR-040 | Staff see new orders for their branch in real time and can accept or reject (with reason) | Must |
| FR-041 | Orders follow a defined lifecycle (see below); invalid transitions are refused by the server | Must |
| FR-042 | The kitchen display shows accepted orders as a queue ordered by time, with item and note detail | Must |
| FR-043 | Kitchen users can mark orders preparing and ready; staff can mark completed | Must |
| FR-044 | Every status change records who, when and from which state | Must |
| FR-045 | Concurrent conflicting updates to one order are detected, not silently overwritten | Must |
| FR-046 | Kitchen display recovers state automatically after a connection loss | Must |
| FR-047 | Staff can view order history with filters (date, status, branch) | Should |

### Order lifecycle (MVP)

```
placed → accepted → preparing → ready → completed
   │         │
   ├→ rejected   (by restaurant, with reason)
   └→ cancelled  (by customer before acceptance, or by staff with reason)
```

`rejected`, `cancelled` and `completed` are terminal. Whether staff may cancel after `accepted` is an open question ([decisions](decisions.md#open-questions)).

### Deferred (not MVP)

Online payments, delivery, inventory, suppliers, expenses, reservations, analytics, push notifications, receipt printing. Recorded so that the MVP design does not preclude them; none is committed.

## Non-functional requirements

| ID | Requirement | Priority |
| :-- | :-- | :-- |
| NFR-001 | **Tenant isolation:** no request can read or modify another tenant's data; enforced in the backend, never by client behaviour | Must |
| NFR-002 | **Authorization:** every endpoint and real-time channel checks role and tenant (and branch where applicable) on the server | Must |
| NFR-003 | **Authentication:** passwords hashed with a modern memory-hard algorithm; sessions revocable; rate limiting on authentication endpoints | Must |
| NFR-004 | **Secrets:** no secrets in source control; configuration from the environment; secrets rotatable | Must |
| NFR-005 | **Data integrity:** order creation and status changes are transactional; money stored as integer minor units, never floating point | Must |
| NFR-006 | **Validation:** all external input validated at the boundary; consistent, documented error format | Must |
| NFR-007 | **Auditability:** security-relevant and status-changing actions are recorded | Must |
| NFR-008 | **Testing:** automated unit, integration and end-to-end tests; mandatory tenant-isolation tests; CI blocks merges on failure | Must |
| NFR-009 | **Real-time latency:** status changes reach connected clients within a target to be set after measurement (initial working target: a few seconds) | Should |
| NFR-010 | **Reliability:** no lost or duplicated orders under client retries or reconnects | Must |
| NFR-011 | **Performance:** targets set after a baseline exists; initial assumption is a small number of tenants with tens of concurrent orders each | Should |
| NFR-012 | **Accessibility:** interfaces target WCAG 2.2 AA; contrast rules in [brand](brand.md) | Should |
| NFR-013 | **Usability under load:** kitchen display legible at distance, operable with gloves or wet hands (large targets), minimal text entry | Should |
| NFR-014 | **Maintainability:** clear module boundaries, documented decisions, lint and type checks in CI | Must |
| NFR-015 | **Observability:** structured logs with request and tenant identifiers; no personal data or secrets in logs | Should |
| NFR-016 | **Privacy:** collect minimal customer data; defined retention for guest orders | Should |
| NFR-017 | **Backups and recovery:** automated backups with a tested restore | Should (before any real data) |
| NFR-018 | **Internationalisation readiness:** no hard-coded currency, locale or timezone assumptions | Should |
| NFR-019 | **Connectivity:** surfaces tolerate unreliable networks (retry with idempotency, clear offline state); full offline operation is not an MVP goal | Should |

## Assumptions to validate

These are assumptions, not findings.

- Restaurants want a single tool covering ordering and operations. (Unvalidated.)
- Restaurants can be configured to fit through settings without custom code. (Unvalidated; the first pilot will test it.)
- Dine-in QR ordering and pickup are the right first order types.
- Payment can follow ordering without invalidating the data model.
