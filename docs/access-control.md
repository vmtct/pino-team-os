# TOS Access Control — Application Contract

`pino-team-os` is the internal staff application surface for PINO. Authorization rules are canonical in `pino-core`; TOS must consume those contracts rather than define a competing role/permission system.

Canonical references:

- `pino-core/docs/access-control-doctrine.md`
- `pino-core/docs/features/proposals/tos-access-control.md` or its approved/superseding successor

## TOS responsibilities

TOS may own:

- login/session UX and authentication-provider integration;
- resolution of an authenticated request to a canonical Core Principal/User;
- Founder/Admin access-management UI;
- feature-specific UI visibility from effective access;
- calls to private Core authorization/access-control contracts;
- protected server orchestration for TOS routes/actions.

TOS must not own a competing canonical copy of:

- Users as authorization identities;
- Roles;
- Permissions;
- Role Permission membership;
- Role Assignments;
- Scope semantics;
- authorization decision rules;
- last-Founder protection.

## Required pattern for protected features

Any new TOS feature that reads non-public data or performs privileged actions must declare before implementation:

- actor(s);
- stable permission key(s);
- scope semantics;
- contextual resource rules;
- UI visibility behavior;
- server enforcement point(s);
- audit event(s);
- explicit deny cases.

If that contract is unresolved, the feature is not implementation-ready.

## Enforcement rules

- Deny by default.
- Never authorize by job title, department, Staff function, route path, client state, or hard-coded role display name.
- Roles are configurable permission bundles; permissions authorize actions.
- UI visibility is not authorization. Direct server/API calls must be denied when permission/scope/context do not allow them.
- Authentication proves/resolves identity; it does not freeze effective permissions for the life of a long token.
- Suspended/disabled Users must not retain privileged access because of stale client/session state.
- Privileged mutations must emit the required Core audit events.

## Founder/Admin surface reserved for implementation

The proposal reserves:

- `/founder/access/users`
- `/founder/access/users/[id]`
- `/founder/access/roles`
- `/founder/access/roles/[id]`
- `/founder/access/audit`

Until the Core access-control proposal becomes APPROVED and implemented, any UI on these routes must be clearly labeled `PROTOTYPE / MOCK DATA` and must not create canonical access-control state.

## Existing TOS auth caveat

Existing staff bearer-link/token flows are not the canonical authorization model for future privileged TOS administration. Authentication may evolve independently, but all privileged paths must ultimately resolve to a canonical User/Principal and use the Core authorization contract.
