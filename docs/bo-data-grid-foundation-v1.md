# BO Data Grid Foundation V1

PAP-383 implements the reusable Back Office data-surface mechanics approved by Founder in PAP-404 prototype build `PAP404-r1`.

## Authority

This foundation is presentation/state orchestration only. Canonical entities, lifecycle rules, permissions, commands, persistence, policy and audit authority remain in Core and their owning feature contracts. A grid never widens a read, invents a lifecycle state, or treats client state as business truth.

## Approved interaction grammar

`Page header → View toolbar → Data Grid → Pagination → Side detail/peek`

Foundation V1 provides typed columns, compact rows, sticky header/optional identity column, search/filter/sort/column toolbar affordances, URL-persisted view state, explicit server-capable pagination, canonical-ID treatment, standard loading/empty/error/permission states, and a reusable right-side detail peek contract.

Saved views, grouping, column resize/reorder, bulk mutation, inline editing, aggregates and virtualization remain outside Foundation V1.

## URL state contract

Shared grid state uses `q`, `sort`, `dir`, `page`, `size` and `f_<filter-key>` query parameters. Consumers own the actual query and server request. Changing search/sort/filter/page-size resets page to 1; explicit page navigation does not.

## Team Surface Decision

```yaml
surface: BO
primary_device: DESKTOP
bo:
  sidebar_group: inherited from owning domain
  subnavigation: inherited from owning domain
  primary_layout: TABLE | SPLIT_VIEW
shared:
  permission_context: unchanged; PLT-ACCESS and owning Core feature remain authority
  cross_domain_links: none introduced by the grid foundation
founder_layout_review: APPROVED
founder_layout_evidence: PAP-404 / PAP404-r1 / 2026-10-09
```

## Implementation rule

Pages configure schemas and domain actions; they do not fork toolbar, row, state, pagination or side-peek mechanics. Server-capable means the primitive emits deterministic state and pagination actions without assuming all rows are loaded client-side.
