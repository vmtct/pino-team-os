# PAP-973 — Team OS isolated staff email egress test

Scope: PAP-639 platform lane, separate from FC1 BO UI. This is a **test-only fake email binding** in `lib/test-support/staging-team-email-egress-boundary.ts` and a targeted test of the **real** `handleForgotPassword` application handler. No production or deployed staging code changes.

## What the test verifies

- In a local Node test runtime on a synthetic/memory-only execution boundary, any attempt to use the injected fake mailer fails before physical email dispatch.
- When the real staff password recovery handler requests a synthetic recovery token from a fake Core RPC stub, the denied send triggers its existing `cancelPasswordReset` compensation. Both known and unknown staff identities retain the generic 202 response.
- A cancellation failure does not expose the token, recipient or staff existence in the response. Outbound receipts contain only attempt counts and booleans.
- Admission fails closed for production, shared staging Worker, D1/R2, service bindings, email sender bindings and secret-bearing bindings.
- No real email message, reset token, Team Worker, Cloudflare binding, database, or network call is involved.

## Critical limitation

`emailMessagesPhysicallySent=0` applies to the **injected test mailer only**. The real `pino-team-os-staging` Worker still has `PINO_STAFF_PASSWORD_EMAIL` send_email binding; this PR does not disable or verify the real sender. PAP-971 remains `HOLD_OUTBOUND` for write tests on shared staging. This is not an authenticated live staging test, not E2E, not a deployment, and not permission to mutate any staging resources.

Run only on isolated Team OS checkout with dependencies installed:

    node --import tsx --test lib/staff-password-recovery-egress-boundary.test.ts

This extends existing `lib/staff-password-recovery-handler.test.ts` behavior without replacing the canonical handler, changing Core RPC contract, disabling production email recovery, or altering PAP-512 release gates. Further runtime clearance requires protected isolated staging test Worker with denied egress, disposable synthetic fixture lifecycle (PAP-197), typed Core/Team API receipts (PAP-198), and mailbox/time controls (PAP-200). Production is always out of scope.
