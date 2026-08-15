# pino-team-os Architecture

## Responsibility

`pino-team-os` is PINO's internal staff/founder application surface. It owns internal UX, authentication/session composition, application-specific orchestration, and adapters to the systems that currently own each domain.

It is not the global canonical domain/runtime layer.

## Domain authority

Authority is determined per domain.

### Notion-backed internal operations

Staff, staff schedule, shift master, timesheet, training, and other operational domains that are still implemented through Team OS Notion repositories remain Notion-backed until an explicit migration changes ownership.

The property-level contract for current staff/schedule data is documented in `DATABASE.md`.

### Core-owned domains

For capabilities modeled canonically in `pino-core`, Team OS consumes the private Core service contract. `lib/founder-core.ts` defines the typed binding used by Founder operations.

Team OS may provide internal forms, projections, dashboards, validation for UI input, and orchestration around the Core contract. It must not maintain a competing canonical copy of Core-owned identity, membership, access policy, booking, attendance, capacity, delivery, catalog, or other Core state.

## Trust boundaries

Founder operations are private. The Founder actor context and private service binding must not be exposed through a public application route.

Notion authorization and Team OS App Access rules remain separate from Core's canonical business authorization. Do not collapse these concepts merely because the same UI displays both kinds of data.

## Migration model

PINO is migrating domain-by-domain rather than replacing Notion globally in one cutover.

For each migration, record:

1. the existing domain owner;
2. the target Core model and canonical identity;
3. legacy/external ID mappings;
4. read/write cutover behavior;
5. verification and rollback expectations;
6. the docs/ADR that mark the authority transition.

Until this is explicit, existing Notion-backed domains remain where they are.

## Cross-repository contract

The canonical cross-repository context is maintained in `pino-core/docs/system-context.md`. A material change to the Team OS ↔ Core boundary should update both repositories' architecture documentation and add/supersede an ADR when the accepted architecture decision changes.
