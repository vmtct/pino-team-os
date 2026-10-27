# PAP-938 — V4 runtime candidate

Source reconciled from #810/#871 into a new isolated current-main branch. See docs/tos-v4-candidate-checkpoint.md for actual implemented scope and gaps; tos-v4-parity-ledger.csv is deliberately nonterminal.

Home and Ca Làm consume the shared V4 DS with authenticated read adapters. Trưởng Ca remains inaccessible regardless of contextual Duty read permission. Other app views retain incomplete fail-closed presentation and are not visual parity PASS. No demo business ledger or simulated successful writes. Diagnostic route remains hard-off in production builds. No staging/deployment/production acceptance claim.
