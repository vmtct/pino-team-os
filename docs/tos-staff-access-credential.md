# TOS Staff Access credential

TOS staff admission uses a dedicated GitHub Actions secret named `CF_ACCESS_API_TOKEN`.

Do not reuse or broaden the Worker/D1 deployment credential for this purpose.

## Cloudflare token scope

Create a Cloudflare API token scoped to the PINO Cloudflare account with only the permissions required by the governed TOS Access workflows:

- `Access: Apps and Policies Edit` — required to read the TOS Access application/policies and create or reuse the staff admission policy.
- `Access: Organizations, Identity Providers, and Groups Read` — required to confirm the configured One-time PIN identity provider.

Restrict Account Resources to the PINO Cloudflare account only. No Worker, D1, DNS, route, zone-write, or other product permission is required by this credential.

## GitHub secret

Store the token as repository Actions secret:

`CF_ACCESS_API_TOKEN`

The token must never be committed, logged, written into issues, or reused by application runtime code.

## Governed activation

After the secret exists, use the existing issue-triggered workflow `[GPT] TOS staff Access reconcile` with the exact current `main` SHA and `CONFIRM: RECONCILE_TOS_STAFF_ACCESS`.

The workflow remains fail-safe: it resolves one TOS Access application, proves the live challenge carries the pinned TOS audience before mutation, refuses any candidate containing the BO hostname, and rolls back a policy created by the run if post-checks fail.
