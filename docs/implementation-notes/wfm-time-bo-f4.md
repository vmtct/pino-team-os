# WFM-TIME-BO/F4 Missed Checkout UI

Team Surface Decision remains BO / DESKTOP / Workforce / SPLIT_VIEW.

For an OPEN TimekeepingSession only, the detail panel exposes `Resolve missing checkout`. The manager must enter an explicit canonical checkout timestamp and reason; the client does not infer attendance. The BO facade forwards the command with a fresh idempotency key to Core F4, awaits success, then silently refetches canonical Timekeeping before the UI changes to CLOSED.

F4 does not expose or mutate WFM-DUTY exception approval state. Once the session is CLOSED, any later timestamp change uses the existing F3 append-only correction UI.
