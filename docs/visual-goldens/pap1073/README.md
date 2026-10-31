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

## Approved successor — 2026-10-31 (PAP-1229)

Founder approved only HO Table 390/320 from [run 41071808375](https://github.com/vmtct/pino-team-os/actions/runs/41071808375), PR #1060 source `877d578ef00334617043e09d14f851717fa25329`, artifact `12984978572`. Approval receipt: [PAP-1073 comment 18831](https://vmtct97.atlassian.net/browse/PAP-1073?focusedCommentId=18831). Exact original CI PNG bytes are retained under `successor-41071808375/`, with provenance and SHA-256/byte pins in its manifest and the verifier's code-owned allowlist. The original 40-file archive and manifest remain immutable and are still validated; the other 28 image references remain the original run. The 1% pixel limit and geometry/negative checks remain unchanged. This approval does not accept live Staging, G4, Production or future images.
