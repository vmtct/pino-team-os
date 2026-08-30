# Pinoria interim release packet

Status date: 2026-08-30

## Guardrail

This packet is intentionally staging-only. Do not deploy or mutate `pino-core` production until the governed production release catches up with the approved main SHA and passes the official release gate.

## Companion slice

The synthetic staging learner has proven the complete canonical chain: two distinct PRESENT/Classroom Diary evidences, Fruit ×2, replay-safe Fruit grants, Feed ×2, `READY_FOR_RITUAL / FEED_2`, replay-safe `COMPANION_RITUAL`, Mori materialization Lv2, TV claim stability, replay-safe completion, and an empty queue after completion.

The learner application may render Companion state, inventory, readiness and ritual outcome, but it must not own feed counts, ritual requirements, level transitions, or reward calculation.

## Wish wearable slice

`LIMITED_WARDROBE` is config-ready through the existing BO catalog, immutable published economy rules, banner snapshot validation, schedule/activate/retire lifecycle, TOS activity runtime, and TV reveal projection.

Interim learner UI may render active banner story, Energy Seed balance, pity, featured guarantee, Resonance, signature-set progress and history. Until a learner-safe write contract exists, draw execution remains on governed TOS staging.

## 2026 Mid-Autumn release

A wearable Mid-Autumn banner can be prepared with the existing canonical family. The current banner contract has one original Bearer and one signature set per immutable snapshot. Male/female artwork under one economy must therefore remain a presentation concern unless product explicitly chooses two canonical banners. Do not add demographic targeting or duplicate economy state merely to swap hero art.

Do not publish a Companion gacha banner through `LIMITED_WARDROBE`. Current Wish pools grant wearables/variants/entitlements while Companion acquisition/evolution has separate canonical handlers. Companion-banner UX can be designed now, but canonical draws wait for an explicit Companion grant model.

An Autumn wearable banner can use the same `LIMITED_WARDROBE` path once its Bearer, signature set, off-banner Mythic, Rare/Common pools and presentation assets exist in the active catalog.

## Staging smoke

Run `npm run test:pinoria-staging` from `pino-team-os`. The smoke is read-only: it verifies Companion projection, Activity runtime, active Wish banner snapshot, Wish state invariants and history without consuming Fruit, Energy Seed, ritual state or TV presentations.

## Production handoff

When Core production is proven at the current governed main SHA: run production-readiness smoke first, then deploy only the exact already-validated surface artifacts, then rerun read-only Pinoria smoke against staging and the approved production projection endpoints. No staging fixture IDs or synthetic learner data should be copied to production.
