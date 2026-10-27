# PAP-938 scoped staging delivery — 2026-10-27

Founder request in this chat: “Đưa lên staging”. Authorizes scoped Team staging UI/read-only delivery and the necessary PR/main promotion through PAP-1026 guarded CD. Jira PAP-938 execution receipt records this request; PAP-512 feature order and shared writer serialization remain in force.

New `/tos-v4` entry is served only for APP_ENV=staging and exact `tos.staging.pinohouse.art` or `pino-team-os-staging.minhtri-van42.workers.dev`. Before rendering, canonical staff password/support credential must pass Core Workforce GET /context with a valid StaffMember-linked context. Missing sessions redirect to staff login, canonical denial fails closed, production/other hosts remain 404. Existing prototype diagnostic gate stays unchanged. This introduces no auth bypass, secret, role/Access rule or new binding.

Current main guarded CD uses safe wrangler.ho-staging.json: BO_UI_ONLY, 8 Core staging service bindings, no send_email/D1/R2/bypass/ingress; keep_vars=false; worker-first host fence; serialized CAS deploy with previous version, provenance readback and guarded rollback. Preserve these controls unchanged. No Core or Production deployment. No browser/integrated E2E.

All new TOS business writers remain disabled. UI/visual acceptance and real authenticated actor readback are separate from serving/boundary proof; no PARITY_PASS or FUNCTIONAL_STAGING_PASS claim. INDIE_WAIVED_BY_FOUNDER under PAP-507; exact-head receipt is supplied with deployment evidence. Team Surface Decision remains TOS mobile, Station desktop ≥1024, six identities with Trưởng Ca disabled.
