# PINO Team OS

## Product

Internal management and founder operations portal for PINO Team.

## Architectural role

`pino-team-os` is an application surface, not the global canonical domain layer.

Authority is defined per domain:

- Staff, staff schedule, shift master, timesheet, training, and other explicitly unmigrated internal operations remain Notion-backed while their current repository contracts still operate against Notion.
- Founder operations for domains implemented in `pino-core` use the private Core service binding and must treat Core/D1 as authoritative for those domains.
- A domain must not be considered migrated merely because another PINO domain has moved to Core.

The previous shorthand “Notion is the source of truth” applies only to the Notion-backed Team OS domains that have not been migrated. It is not a global PINO architecture rule.

## Current Notion-backed data contracts

- Staff
- Staff Schedule
- Shift Master
- Timesheet
- Training Progress
- other repository-owned operational data explicitly implemented against Notion

See `DATABASE.md` for the current staff/schedule contract.

## Migration rules

- Canonical English properties are used by the app for current Notion-backed domains.
- `LEG_*` properties are migration-only.
- Never infer missing HR data.
- Never hard-code shift codes to times; shift times come from Shift Master.
- Do not delete legacy fields until the relevant app path is verified and its migration plan says they are removable.
- When a domain migrates to Core, document ownership/cutover explicitly and update this file in the same delivery window.

## Founder control plane

Founder operations that target Core-owned domains call the private `pino-core` binding. Team OS may shape internal UX and orchestration, but must not duplicate canonical Core rules or expose Founder capabilities through a public trust boundary.

## UI

Warm, minimal, premium, operational. Avoid corporate-dashboard heaviness.

## Start here

Read `AGENTS.md` and `docs/architecture.md` before architecture-affecting changes. For Core-owned capabilities, also read `pino-core/docs/system-context.md`, `pino-core/docs/principles.md`, and relevant accepted ADRs.
