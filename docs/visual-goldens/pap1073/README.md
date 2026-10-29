# PAP-1073 — Founder-approved fixture visual golden (2026-10-29)

Founder approved the **30 PNG screenshots** linked from GitHub Actions run [40811677302](https://github.com/vmtct/pino-team-os/actions/runs/40811677302) on 2026-10-29. Artifact: `pap1073-g3-geometry` (ID `12870189049`), source SHA `aa0d5fd88ad09de25c14cc154a68fbf95d2d8f49`.

The archive included 30 PNG and 10 geometry JSON files. Exact originals are stored under `run-40811677302/bo|ho/{1440,1024,768,390,320}/{table,drawer,detail}.png` plus `geometry.json` for each viewport. `manifest.json` pins each file's SHA-256 and bytes so approval persists after the transient Actions artifact expires (2026-11-12).

## Scope and limitations

- **APPROVED**: G3 fixture screenshot visual baseline (Table, Drawer, Full Detail, BO and HO, five viewport widths) and the previously accepted G3 design contract.
- **NOT APPROVED BY THIS ACTION**: automatically replacing authoritative BO/HO prototype, production pages, Staging runtime screenshots, any future changed golden, G4 auth/ACL validation, visual/accessibility validation on live screens, or Production release.
- Geometry JSON is retained as supporting measurements; numeric acceptance checks continue to apply independently.
- Any image change requires a new visual review and explicit Founder approval. Do not silently regenerate and overwrite these images.
- Follow-up technical scope: compare admitted actual BO/HO routes and authoritative prototypes with the pinned baseline, fix discrepancies, complete accessibility, then reconcile PAP-1073 and G4 separately.

Jira: https://vmtct97.atlassian.net/browse/PAP-1073
