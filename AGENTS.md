# PINO Team OS — AI Working Contract

`pino-team-os` is an internal application surface. Before changing data flow or business behavior, determine which domain currently owns the state.

## Read order

1. `docs/architecture.md`
2. `PROJECT.md`
3. `DATABASE.md` for Notion-backed staff/schedule contracts
4. `docs/access-control.md` when work touches protected TOS data/actions, authentication-to-user resolution, roles, permissions, scopes, or access administration
5. relevant source/tests
6. `pino-core/docs/system-context.md`, `pino-core/docs/principles.md`, and relevant accepted Core ADRs when touching a Core-owned capability
7. for TOS authorization work, `pino-core/docs/access-control-doctrine.md` and `pino-core/docs/features/proposals/tos-access-control.md` or their approved/superseding successors

## Invariants

- Authority is per domain. Do not assume Notion or D1 is globally authoritative for all PINO data.
- Staff/HR/schedule and other explicitly unmigrated domains may remain Notion-backed until intentionally migrated.
- For Core-owned domains, use the private Core binding/contracts and treat Core state/rules as authoritative.
- Do not duplicate Core-owned identity, membership, access, booking, attendance, capacity, catalog, or delivery invariants inside Team OS merely for UI convenience.
- The private Founder control plane is a trust boundary. Do not expose it through public routes or weaken actor/authentication requirements.
- Do not use another module/repository's internal persistence details as an application API.
- Preserve current Notion migration rules: do not infer missing HR data, do not hard-code shift times, and do not remove legacy fields without an explicit verified migration.
- When a domain migrates from Notion to Core, update `PROJECT.md`, `DATABASE.md` if applicable, `docs/architecture.md`, and the Core system-context/ADR documentation in the same delivery window.

## Access-control discipline

Any new TOS feature that reads non-public data or performs a privileged action must have an explicit Access Control contract before implementation.

- Deny by default when no explicit permission grants access.
- Authorize by stable permission key + scope + contextual resource policy; never by job title, department, Staff function, route path, client-side state, or hard-coded role name.
- Treat roles as configurable permission bundles, not application behavior switches.
- UI visibility is not authorization. Every privileged server read/mutation must enforce authorization server-side.
- Authentication resolves identity to a canonical Principal/User; it does not become the permission source of truth.
- User and StaffMember are distinct concepts even when linked.
- Do not add ad-hoc permission strings inside route/components. Declare/register them through the canonical Core feature/access-control contract.
- Privileged mutations must emit the required audit events.
- Any mock Founder Access UI must be clearly labeled `PROTOTYPE / MOCK DATA` until the Core access-control spec is APPROVED and integrated.

Before implementing a protected feature, its canonical spec must state:

- actors;
- permission keys;
- scope semantics;
- contextual rules;
- UI visibility behavior;
- server enforcement points;
- audit events;
- explicit deny cases.

If those are unresolved, stop at proposal/prototype rather than inventing authorization behavior in code.

## Change discipline

If code and docs disagree about domain authority, stop treating the shorthand documentation as truth. Inspect the actual adapters/repositories and Core ADRs, then reconcile the documentation as part of the change.
