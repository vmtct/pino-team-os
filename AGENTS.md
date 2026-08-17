# PINO Team OS — AI Working Contract

`pino-team-os` is an internal application surface. It does not become the canonical owner of shared PINO business rules merely because it renders or operates them.

## Read order for material behavior

Before changing material business behavior, protected data flow, or a Core-owned capability:

1. read this repository's `docs/architecture.md`, `PROJECT.md`, and relevant local data/source/tests;
2. resolve the canonical Core `featureId` in `pino-core/docs/features/feature-registry.json`;
3. read `pino-core/docs/feature-governance.md` and `pino-core/docs/platform-foundations.md`;
4. read the registered feature spec and relevant accepted ADRs;
5. if the Core registry says `READY_FOR_CODEX`, read and obey the registered handoff before runtime integration;
6. when protected TOS behavior is involved, read the approved Access Control spec/greenfield bootstrap/handoff in Core.

If the required Core governance/spec material is unavailable, stop before inventing material business behavior and report the missing dependency.

## Feature readiness is implementation authority

- `READY_FOR_CODEX` — implementation may proceed against the registered approved spec/handoff.
- `READY_WITH_PREREQUISITES` — prototype/review may continue, but blocked runtime integration waits for named prerequisites.
- `PROPOSAL_ONLY` — prototype/product exploration only; do not turn mock logic into canonical backend behavior.
- `RECONSTRUCTED_ONLY` — current-state evidence only; not future implementation authority.

A local prototype, merged UI branch, or working mock is not an approval source.

Product decisions discovered while prototyping must be reconciled into the canonical Core feature spec before canonical runtime implementation.

## Core ownership boundary

- For Core-owned domains, use explicit private Core contracts; do not query Core D1 directly.
- Do not duplicate Core-owned identity, membership, access, booking, attendance, capacity, catalog, delivery, policy, or other shared invariants inside TOS for convenience.
- Notion may remain authority only for explicitly unmigrated domains; never assume Notion or D1 is globally authoritative.
- Do not import another module/repository's persistence adapter as an application API.
- When a domain migrates to Core, update app architecture/data docs in the same delivery window.

## Access-control discipline

Any TOS feature that reads non-public data or performs a privileged action requires the canonical Access Control contract.

- Deny by default.
- Authorize server-side by stable permission + canonical scope + contextual policy; never by job title, route, client state, hard-coded role, email allowlist, or Cloudflare Access group.
- UI visibility is not authorization.
- Authentication resolves an external identity to canonical User; Core remains authorization authority.
- User and StaffMember are distinct even when linked.
- Do not invent ad-hoc permission strings in components/routes.
- Privileged mutations emit the audit events required by the Core spec.
- Never expose Founder/private Core control-plane operations through a public application contract.

When the Core feature registry or Access handoff says a prerequisite is not ready, do not add a temporary privileged bypass.

## Prototype discipline

A Founder prototype may contain mock data and interaction-only state when clearly labeled.

Prototype code must not become architecture by accident:

```text
prototype finding
  -> canonical Core spec update
  -> Founder approval when behavior changed
  -> technical readiness/handoff
  -> runtime implementation
```

Do not make backend/schema/API design decisions solely because they are convenient for the prototype component tree.

## Change discipline

For a material cross-repository feature:

1. identify the Core `featureId` in the PR/implementation notes;
2. verify registry readiness before runtime work;
3. preserve F1–F7 decisions from the canonical spec;
4. keep UI adaptation separate from canonical business semantics;
5. add/update TOS tests for the app boundary;
6. surface any spec/code mismatch instead of silently choosing one side;
7. require independent spec ↔ Core/app code ↔ tests review before staging/production readiness.

Production deployment remains an explicit release action. A green build or merged PR does not itself authorize production.
