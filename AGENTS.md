# PINO Team OS — AI Working Contract

`pino-team-os` is an internal application surface. Before changing data flow or business behavior, determine which domain currently owns the state.

## Read order

1. `docs/architecture.md`
2. `PROJECT.md`
3. `DATABASE.md` for Notion-backed staff/schedule contracts
4. relevant source/tests
5. `pino-core/docs/system-context.md`, `pino-core/docs/principles.md`, and relevant accepted Core ADRs when touching a Core-owned capability
6. the current `pino-core` TOS access-control feature spec whenever a capability reads non-public data or performs a protected action

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

Any TOS capability that reads non-public data or performs a privileged action must declare its access contract before implementation is considered complete.

- Deny by default when no explicit permission grants the action.
- Authorize by stable permission key, scope, and contextual resource policy; never by job title, page/route, client-side state, or hard-coded role name.
- Roles are configurable permission bundles. A new business role must not require new authorization branches in application code.
- UI visibility is not authorization. Every privileged server action must enforce authorization again on the server.
- Authentication resolves a canonical Principal/User; client-supplied role or permission claims are not trusted authorization authority.
- User and StaffMember remain distinct concepts even when linked.
- Protected mutations must emit their required audit events.
- Do not invent ad-hoc permission strings inside routes or components; use the canonical permission registry/contract.

Every protected feature spec must include an `Access Control` section covering actors, permission keys, scope, contextual rules, UI visibility, server enforcement, and audit events.

## Change discipline

If code and docs disagree about domain authority, stop treating the shorthand documentation as truth. Inspect the actual adapters/repositories and Core ADRs, then reconcile the documentation as part of the change.
