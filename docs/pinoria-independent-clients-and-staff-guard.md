# Pinoria prototype — independent clients + staffing guard

Status: prototype review note. This is not implementation authority and does not replace the future Core-approved S18 handoff.

## Independent client doctrine

TOS and Pinoria TV are independent clients. A staff member may use TOS from a phone, tablet, or another browser while `RECEPTION_TV` runs on the fixed reception laptop.

The production direction is:

`Staff TOS client → Core command/event → TVEvent queue → RECEPTION_TV polling/claim/ack`

No staff browser needs to open, own, focus, or directly message the TV browser. The prototype now simulates this with `/api/pinoria-prototype/tv-relay`, an in-memory mock relay. It is intentionally not canonical storage.

Presence truth commits independently from presentation. Vào học/Tan học may succeed while TV is offline. Arrival/departure presentation is queued separately. Replay creates presentation only and never repeats attendance, choice, reward, inventory, companion, or random outcomes.

`RECEPTION_TV` is a presentation surface. Production authorization must be scoped to surface sync/poll/claim/ack and must not grant staff/business mutation capabilities.

## Staffing guard for Vào học / Tan học

A staff-originated presence command is allowed only when all conditions pass server-side:

1. The actor has the required capability, provisionally `presence.manage`.
2. The actor has an ACTIVE canonical staff-presence session at the same PINO location. Client GPS or a client-owned boolean is not sufficient proof.
3. The command is inside the authorized staffing presence-operation window.

The prototype uses a review-only example window of the scheduled shift ±15 minutes: a 14:00–21:00 shift yields a 13:45–21:15 presence-operation window. This value is provisional and belongs to Staffing policy, not Pinoria.

The client may hide or disable actions for usability, but Core must re-check the guard on every Vào học/Tan học command. UI visibility is never authorization.

Future privileged override, if allowed, must be a distinct audited capability/command with mandatory reason. Do not let ordinary staff bypass a failed guard.

Audit provenance for presence commands should include actor staff id, resolved capability, staff-presence session id, location id, requested timestamp, effective policy/window, and any explicit override reason.

## Prototype review controls

The Founder prototype includes a Staffing Guard modal that can toggle the three conditions to review ALLOW/DENY UX. These toggles simulate server decisions only. They must not become a production trust mechanism.
