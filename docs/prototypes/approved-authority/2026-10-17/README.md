# Approved prototype authority snapshots — 2026-10-17

Purpose: eliminate workstation-local prototype dependencies from PAP-512 execution. These are immutable evidence snapshots copied from the i3 workstation and committed to Git. Production/runtime implementation remains governed by Jira + current source; these snapshots are UX/reference authority only.

## Snapshots

- PAP-700 TOS Home/Ca Làm: exact UI source plus `runtime-overlay.patch` and base commit for deterministic rehydration.
- PAP-670 Timekeeping UX v1: complete local prototype bundle, including audit scripts/screenshots.
- PAP-621 Workforce Schedule v2: complete local prototype bundle.
- PAP-727 Learning Mission/Diary v1: complete OneDrive-backed prototype bundle used by PAP-723/PAP-724.

## Integrity

`SHA256SUMS.txt` records every archived file. Once this snapshot is merged, i3 is not an authority or prerequisite for these prototypes.

## Rule for FC

Use Jira requirements as implementation authority and these snapshots only for approved UX/parity evidence. Never block on i3 availability. Do not mutate snapshots in-place; create a new dated snapshot if Founder approves a new prototype revision.
