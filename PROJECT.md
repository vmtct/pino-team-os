# PINO Team OS

## Product
Internal management portal for PINO Team.

## Source of truth
Notion. The Next.js app is the experience/application layer.

## Canonical databases
- Staff
- Staff Schedule
- Shift Master
- Timesheet
- Training Progress
- Path Programs

## Migration rule
- Canonical English properties are used by the app.
- LEG_* properties are migration-only.
- Never infer missing HR data.
- Never hard-code shift codes to times.
- Shift times are always read from Shift Master.
- Do not delete LEG_* until the app is verified in production.

## MVP
1. Staff dashboard
2. Staff directory
3. Shift Master
4. My profile
5. Schedule
6. Timesheet
7. Training

## UI
Warm, minimal, premium, operational. Avoid corporate-dashboard heaviness.
