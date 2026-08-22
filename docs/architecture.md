# PINO Team OS architecture

PINO Team OS is an internal experience and application layer. It renders workflows and adapts canonical contracts; it does not become the authority for shared PINO business rules or protected data.

## Authority boundaries

- PINO Core owns canonical identity, staff, membership, access control, catalog, delivery, booking, attendance, capacity, and policy invariants.
- Team OS calls explicit private Core contracts through service bindings. It never queries Core D1 directly or imports Core persistence adapters.
- Notion remains authoritative only for explicitly unmigrated domains documented in `PROJECT.md` and local data-source records.
- Cloudflare Access authenticates an external identity at the perimeter. Core resolves that identity and performs server-side authorization using stable permissions, canonical scope, and contextual policy.
- Client visibility and host routing are defense-in-depth, not authorization.

## Application surfaces

`tos.pinohouse.art` is the general Team OS surface. `bo.pinohouse.art` is a separately authenticated Back Office surface. Host-boundary routing prevents BO pages and APIs from being served on the TOS host and exposes only explicitly allowlisted BO routes on the BO host.

The BO operational read plane is registered in Core as `bo-operational-read-plane`. Team OS forwards verified BO Access identity and an allowlisted GET path through `PINO_BO_CORE` to `BoAccessControlPlane`. Core first requires BO entry permission and then `bo.operations.view` in global scope. The contract is read-only and returns canonical projections for Path Programs, Running Classes, Syllabi, Sessions, and Session Registrations. There is no application fallback, local persistence, or privileged mutation path.

## Change rule

Material behavior follows the repository working contract and the registered Core feature specification and runtime handoff. A merge does not authorize production deployment; production release is always a separate explicit action.
