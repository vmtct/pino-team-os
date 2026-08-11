# PINO Team OS — Data Contract v1

## Staff
Canonical:
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

LEG_* fields are never consumed by the app.

## Shift Master
Canonical:
- Name (shift code: S1/S2/C1/C2/T1/T2)
- Period
- Start Time
- End Time
- Active

The app must never hard-code shift times.

## Staff Schedule
Canonical:
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
App Access controls authorization. Role is descriptive and must not be used as the sole authorization rule.
