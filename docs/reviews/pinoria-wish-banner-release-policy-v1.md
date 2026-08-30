# Pinoria Wish Banner Release Policy v1

Status: product/canonical design knowledge for staging implementation. This document does not by itself authorize a production release.

## What we learn from Genshin

1. A release phase has a small number of featured fantasies, not a wall of equal banners. Genshin commonly runs concurrent Character Event wishes, while separate wish types remain distinct.
2. Pity continuity follows the banner family/type rather than the marketing instance. Character Event Wish and Character Event Wish-2 share guarantee progress across rotations.
3. Rotation must not erase earned progress. A learner can skip one featured owner and retain pity for the next owner in the same family.
4. Separate product fantasies may have separate economies. Character, weapon and Chronicled wishes do not all share one pity pool.
5. A featured banner is a story + identity package around one owner. The actual collectible system can contain multiple item outcomes underneath it.
6. Back-catalog catch-up should be a later lane, not compete equally with every new release. Genshin uses a separate Chronicled Wish for selected older content.
7. Reveal animation follows an already-resolved result. Do not add roulette stop buttons, pick-a-card control, adjacent rare-item near misses, or other fake agency.

## Pinoria canonical application

- `LIMITED_WARDROBE` is the primary featured family. Pity, featured guarantee and C0-C6 Original Bearer Resonance carry across banner instances in that family.
- A banner spotlights the lore owner of one signature wearable set. Drops remain item-level: individual signature pieces, whole-set completion through protection, off-banner wearables and duplicate/resonance outcomes.
- Do not hard-filter male/female banners by learner sex. Both are discoverable. Ordering may follow avatar compatibility or explicit learner choice, but eligibility and pity must not depend on sex.
- At one time, show at most **two featured Wearable banners** in the primary release surface. They share the same `LIMITED_WARDROBE` pity family.
- A **Companion campaign/banner surface** may run in parallel only as an orthogonal acquisition fantasy. Today Companion authority is Egg/Hatch/Ritual, not the Wearable Wish engine; therefore the UI must not silently make Companion a Wish drop. If Companion gacha is ever introduced, it requires its own canonical family/economy first and must not consume or reset Wearable pity.
- Do not launch an additional generic seasonal Wearable banner simultaneously when two festival Wearable banners are already active. Rotate it into the next phase instead.

## Recommended seasonal cadence

For an 8-10 week Pinoria arc, use two marketing phases rather than four equal concurrent banners:

- Phase A: festival/event spotlight. Example Mid-Autumn = female owner + male owner concurrently, both `LIMITED_WARDROBE` and sharing pity.
- Optional parallel lane: one temporary Companion banner if it is intentionally being used as the hype beat for that event.
- Phase B: broader seasonal owner/banner, e.g. Autumn, after the festival spotlight rotates out.
- The exact phase duration remains economy-driven; do not freeze it until Energy Seed earning and target pull opportunity are measured.

## Release lifecycle

`TEASE -> PREVIEW/TRY-ON -> ACTIVE -> CLOSING -> RETIRED -> RERUN/ARCHIVE_ELIGIBLE`

- Preview/try-on is presentation only and grants no ownership.
- Banner activation must reference an exact immutable published Rule Version/hash.
- Historical draws keep their original rule snapshot even after later economy versions publish.
- Retiring a banner never resets family pity or featured guarantee.
- Reruns can coexist with a new owner only when they remain inside the same family and preserve pity continuity.
- A future `MEMORY_ARCHIVE`/back-catalog family should be separate and lower prominence. Initial eligibility heuristic: multiple prior featured runs plus at least one full-arc cooldown; freeze exact thresholds only after catalog depth is sufficient.

## Mid-Autumn decision

Do **not** run four equal top-level banners (`female Mid-Autumn`, `male Mid-Autumn`, `Companion`, `Autumn`) at once.

Use: **2 Mid-Autumn Wearable banners + optional 1 Companion banner** during the festival phase. Move the Autumn Wearable banner to the following phase. This preserves choice without fragmenting attention, while Wearable pity remains continuous across the owner rotation.

## BO constraints to implement next

Add release-group knowledge so BO can validate: maximum featured slots per family/phase, overlap conflicts, exact pity family, immutable rules version, release priority, and phase dates. TOS should disclose the active family/rule/pity; TV remains reveal-only and must never decide banner availability or outcomes.

## Source audit notes

Official HoYoLAB references checked for this policy:
- Character Event Wish-2 Mechanics Description (Genshin Impact Official, article 1387602): Character Event Wish and Wish-2 share pity and featured guarantee across rotations; other Wish types are independent.
- Version 5.7 Event Wishes Notice – Phase I (Genshin Impact Official, article 39353510): two Character Event Wish lanes run in the same phase, alongside the separate Weapon Event Wish.
- Chronicled Wish Rules & FAQ (Genshin Impact Official, article_pre/18014398241032513): Chronicled pity carries within its own type while Fate Points reset per period; archive eligibility was later relaxed to at least two prior Character Event Wish appearances plus not recent.

These are reference mechanics, not Pinoria requirements. Pinoria intentionally keeps the primary Wearable family simpler: family pity and featured guarantee remain durable across owner rotations, while release-slot limits and seasonal sequencing are Pinoria product policy.