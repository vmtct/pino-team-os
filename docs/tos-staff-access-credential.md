# TOS Staff Access credential

TOS staff admission uses two distinct credentials with separate trust boundaries:

- `CF_ACCESS_API_TOKEN` is the control-plane credential used only by governed GitHub Actions that read or edit Access applications and policies.
- `CF_ACCESS_EVALUATOR_API_TOKEN` is the evaluator-runtime source credential used only to configure `pino-access-evaluator`. It must be a different opaque value from the control-plane token.

Do not reuse or broaden Worker/D1 deployment credentials for either purpose, and never copy the control-plane Access credential into application runtime.

## Cloudflare token scope

Create a Cloudflare API token scoped to the PINO Cloudflare account with only the permissions required by the governed TOS Access workflows:

- `Access: Apps and Policies Edit` — required to read the TOS Access application/policies and create or reuse the staff admission policy.
- `Access: Organizations, Identity Providers, and Groups Read` — required to confirm the configured One-time PIN identity provider.

Restrict Account Resources to the PINO Cloudflare account only. No Worker, D1, DNS, route, zone-write, or other product permission is required by this credential.

## GitHub secrets and runtime separation

Store the control-plane token as repository Actions secret `CF_ACCESS_API_TOKEN`. Store the distinct evaluator-runtime source as `CF_ACCESS_EVALUATOR_API_TOKEN`.

The evaluator credential must be least-privilege and read-only for the evaluator's required Access lookups. It must not carry `Access: Apps and Policies Edit`, Worker, D1, DNS, route, or zone-write authority. The `access-sync-worker-secret` workflow refuses configuration when the evaluator and control-plane opaque values hash identically, then writes only the evaluator credential into the evaluator Worker secret.

Neither token may be committed, logged, or written into issues. The control-plane token must never be reused by application runtime code.

## Governed activation

After the secret exists, use the existing issue-triggered workflow `[GPT] TOS staff Access reconcile` with the exact current `main` SHA and `CONFIRM: RECONCILE_TOS_STAFF_ACCESS`.

The workflow remains fail-safe: it resolves one TOS Access application, proves the live challenge carries the pinned TOS audience before mutation, refuses any candidate containing the BO hostname, and rolls back a policy created by the run if post-checks fail.
