# PINO Team OS — Notion-backed Data Contract v1

This document describes canonical property contracts **within the current Notion-backed Team OS staff/operations domains**. “Canonical” here means canonical for that repository/domain contract; it does not mean Notion is the global canonical store for all PINO domains.

When a domain is intentionally migrated to `pino-core`, Core ownership and migration documentation supersede the corresponding Notion-backed authority for that domain.

## Staff

Canonical properties for the current Notion-backed Staff contract:

- Name
- Email
- Phone
- Employment Status
- Employment Type
- Start Date
- Probation End
- End Date
- Department
- Role
- Manager
- Functions
- App Access
- User ID
- Programs
- AC Level
- PH Level
- LPA Level
- LPP Level
- Notes

`LEG_*` fields are never consumed by the app except where an explicit migration path documents otherwise.

## Shift Master

Canonical properties for the current Notion-backed Shift Master contract:

- Name (shift code: S1/S2/C1/C2/T1/T2)
- Period
- Start Time
- End Time
- Active

The app must never hard-code shift times.

## Staff Schedule

Canonical properties for the current Notion-backed Staff Schedule contract:

- Staff
- Week
- Monday Shifts
- Tuesday Shifts
- Wednesday Shifts
- Thursday Shifts
- Friday Shifts
- Saturday Shifts
- Sunday Shifts
- Schedule Status
- Lesson Plan
- Internal Note
- Staff Note

Legacy form fields remain during migration.

## Security

App Access controls authorization for these Team OS paths. Role is descriptive and must not be used as the sole authorization rule.

Private Founder operations against Core-owned domains follow the separate Core service trust boundary described in `docs/architecture.md`.
