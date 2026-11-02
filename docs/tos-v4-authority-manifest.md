# PAP-938 / PAP-1014 — DS V4 authority manifest

Authority read in full: D:/pino-work/TOS_STAGING_CODEX_HANDOFF_DS_V4_20261026.md, plus canonical README (CURRENT UI), UI_ADJUSTMENTS_20261026, DS V4 audit, superseded V3 CSS audit and local i5 anchor, in that order.

Source ZIP SHA256: `74C95D3B1261C5B843DB1D92640C4581D03CE9354A9308DDC15C1415D9403B36`. Rechecked against canonical OneDrive. Latest source ZIP in that folder remains the 19:07 DS V4 adjustments; the standalone ZIP is older. No newer source ZIP was observed. Later handoff documents are not a new UI build.

Fresh extraction: 58 files; digests in tos-v4-source-manifest.json. Frozen dependency graph: tos-v4-authority-package-lock.json (SHA256 `e34e12217af55d8811692856c31dcb1ca1950397cc802f1db23642bdf88e2e54`). Next 16.4.2, React/React DOM 19.3.1, TypeScript 5.9.3, PostCSS 8.5.23. Independent npm ci used this lock; no dependency junction, no stale out copied. Source check PASS (95 semantic tokens, 0 important, 0 hex-named palette, 4 allowed dynamic inline styles); TypeScript and clean static export PASS. First sandboxed export hit EPERM; rerun with approved filesystem access passed.

Local served prototype remained untouched and responds HTTP 200. Served HTML SHA256 79f9b972c1b6962f5cadde4f323ea2409139d48ae24d1208f77fad9312f27811. Rebuilt HTML SHA256 efc8395ac0df424a3ec2e2568698b40dffc780017feddcc4e074369c37afc2c4. They differ: build identifiers/dependency resolution are not pixel-equivalence evidence. No same-build or visual match is claimed.

Historical screenshot URIs/hashes are inventoried in tos-v4-historical-screenshots.json. They are PROTOTYPE_ONLY, not fresh runtime goldens. Fresh before/after/diff and physical iPhone Safari evidence: NOT_RUN. Existing Founder policy forbids browser/integrated E2E before production ship; no browser was launched. No visual PASS is inferred from source/build. The 360-row screen/tab/modal/CTA × viewport ledger explicitly retains gaps.

Baseline viewports: 320/360/375/390/414/430/768/1024/1440/1920, landscape 568×320 and 844×390. Source geometry was audited; computed/runtime geometry, touch, focus, scroll, camera hardware and Safari remain unverified.

External visual assets: configured TOS asset base /Background.jpg and /AppIcon/shift.png, frontdesk.png, tosStation.png, shiftlead.png, class.png, training.png. URLs retained; remote bytes not downloaded or hash-frozen. The ZIP contains public/pap934-duty.svg and index-local.html, both included in the source manifest. Remote asset byte pinning is an open CP0 evidence gap.
