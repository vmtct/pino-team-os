# PAP-1014 TOS Design System — shared runtime package (DS0–DS1)

Authority: https://tos.proto.pinohouse.art/ and OneDrive:
PAP-934-tos-master-v3/TOS_STAGING_UI_ANCHOR_V1_20261026.md

## Architecture
- tokens.css is scoped semantic token source for TOS VNext only.
- components.module.css owns all primitive CSS for mobile/desktop variants.
- TosDesignSystem.tsx owns the single implementation for Frame/Header/Nav/Card/Sheet/Button/Field/Toast/Status/IconButton.
- index.ts exports typed App* API plus TosVNext* aliases for coexistence with FC2.
- app/components/tos-vnext/TosVNextUI.tsx is compatibility re-export only.
- Local app layout remains in tos-vnext.module.css; do not duplicate primitives.
- Production rollout remains disabled; import does not enable TOS VNext.

## Acceptance
npm run tos:ds:check is architecture/CI gate, not screenshot or Core E2E.
DS2–DS4 still need screenshot parity at 320/390/430/768/1024/1440/1920,
stable Classroom slots and removal of ad-hoc CSS overrides, keyboard/touch
accessibility acceptance and real authenticated API role/center reads.
No staging deployment before PAP-512/Founder/FC1 admission.

## Provenance
Branch feat/pap1014-tos-ds-v2 from PAP-938 HEAD 20afab64537f4734bb4c21c6deb3aef4dab882e3.
Independent of FC2's writer worktree. No Production, Staging, outbound, R2, D1 writes.
