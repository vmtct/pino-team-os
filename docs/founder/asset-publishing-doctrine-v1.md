---
title: PINO Asset Publishing Doctrine
status: CANONICAL_V1
owner: Founder
scope: pino-asset-publisher operational tooling
canonical_source: pino-team-os/docs/founder/asset-publishing-doctrine-v1.md
implementation_repo: vmtct/pino-asset-publisher
updated: 2026-08-20
---

# PINO Asset Publishing Doctrine v1

## Purpose

This document is the Founder-approved operating doctrine for the non-critical Canva → Cloudflare R2 asset publishing workflow implemented by `vmtct/pino-asset-publisher`.

It is canonical for asset-ingestion and storage-addressing rules used by that tooling. It does **not** make the publisher the canonical owner of PINO inventory, pricing, rarity, campaign eligibility, learner entitlement, or other shared product/business semantics.

If implementation conflicts with this doctrine, normal publishing must stop until the implementation is reconciled.

## Decision classification

The rules here are primarily:

- `INVARIANT` — stable ingestion/storage rules ordinary publishing must not reinterpret;
- `DEPLOYMENT_CONFIG` — technical secrets, endpoints, bindings, and environment configuration.

They are not generic mutable Founder Policy Center settings.

## Separation of concerns

The asset system has three distinct layers:

```text
R2 path
→ where the binary physically lives

Publisher/import metadata
→ source provenance + ingestion classification required to identify and import the asset safely

Core asset metadata
→ canonical product/business meaning once AssetDefinition / AssetRevision exists
```

Do not collapse these layers.

### R2 physical storage

R2 paths remain semantically thin and stable.

Canonical pattern:

```text
pinoria/assets/<asset-slug>/<version>/<role>.<ext>
```

Examples:

```text
pinoria/assets/birthday-hat/v001/layer.png
pinoria/assets/birthday-hat/v001/standalone.png
pinoria/assets/mori/v001/idle.png
```

Physical paths must not encode mutable taxonomy such as audience, slot, gender presentation, rarity, price, campaign, entitlement, or product category.

### Publisher/import metadata

The publisher registry is allowed and expected to retain enough structured metadata to make every published binary intelligible and importable.

For the current V3 contract, each asset role/revision must resolve at least:

```text
assetId
assetSlug
assetFamily
assetRole
assetVersion
audience
slot
gender
registrationProfile
source
sourceRef
Canva designId
Canva pageId
page number at publication time
physical object path
publishedAt
```

Example:

```text
assetId: asset_birthday_hat
assetSlug: birthday-hat
assetFamily: cosmetic
assetRole: layer
assetVersion: v001
audience: learner
slot: headwear
gender: neutral
registrationProfile: learner-v1
source: canva
sourceRef: canva:birthday-hat
```

These semantic fields are **publisher/import classification**, not final Core authority. They exist so GPT/operator sessions, Studio import, and future Core ingestion do not lose meaning between Canva and canonical domain creation.

When Core AssetDefinition / AssetRevision becomes authoritative, Core may validate, normalize, supersede, or enrich these fields without requiring an R2 path move.

### Core asset metadata

Canonical business/product semantics belong to Core/D1 once the relevant domain exists. Examples include rarity, price, campaign eligibility, entitlements, inventory ownership, and any normalized asset classification that Core explicitly adopts.

Frontend config is never the canonical owner of those semantics.

## Canva source identity

Canva is artwork source, not product database.

For source tracking:

- `designId + pageId` is stable source identity;
- page number is convenience/debug only and may shift;
- GPT/operator must never use page number alone for duplicate detection.

## Asset identity

`asset-slug` is stable human-readable storage identity.

Rules:

- lowercase kebab-case;
- do not encode mutable taxonomy in the slug;
- prefer semantic object identity such as `birthday-hat`, `star-glasses`, `hologram-wings`;
- avoid sequence-only names unless the object genuinely lacks meaningful identity;
- slugs and publisher `assetId` values are not Core opaque canonical IDs.

Publisher `assetId` is deterministic from slug:

```text
birthday-hat → asset_birthday_hat
```

`sourceRef` is also deterministic:

```text
birthday-hat → canva:birthday-hat
```

GPT sessions must not invent alternate values for those deterministic identifiers.

## Revision/version rules

Versions are zero-padded:

```text
v001
v002
v003
```

A successfully published production revision is immutable in intent.

- materially changed artwork normally increments version;
- publisher must not silently replace a revision with different source/artwork;
- same-version repair is only for explicit technical repair of the intended same revision.

## Asset roles

Initial canonical roles:

- `layer` — composable runtime layer aligned to registration/canvas contract;
- `standalone` — prominent centered presentation representation of the same asset revision;
- `idle` — idle representation where appropriate.

Additional roles must be added to the machine contract before use.

`layer` and `standalone` sharing slug/version are two roles of one asset revision.

## Taxonomy discipline

GPT/operator must use the repository taxonomy exactly.

- do not invent audience values;
- do not invent slots;
- there is no `eye` slot in the current contract: facial/eye-expression artwork uses `face`; glasses use `eyewear`;
- required gender and registration-profile values come from the canonical taxonomy config.

If a real asset does not fit the taxonomy, mark it `REVIEW_REQUIRED` and update the contract separately.

## GPT/operator contract

When the operator says `asset ready, bắt đầu upload đi` or equivalent, the executing GPT/operator must:

1. read latest publisher SOP, taxonomy, storage config, policy, schema, and registry;
2. audit the complete non-empty Canva source, not only newest pages;
3. compare current `designId + pageId` with registry before deciding what is new;
4. classify every safe candidate with the complete required metadata contract;
5. never invent an R2 path;
6. submit structured requests through GitHub/Worker rather than manual file upload;
7. verify Worker result and registry mirror;
8. report published, skipped, conflict, and review-required outcomes separately.

Conversation memory is not authoritative over repository contract or registry state.

## Server enforcement

Critical invariants belong in the Worker, not only prose.

The Worker must:

- derive physical path from `slug + version + role`;
- derive deterministic publisher `assetId` and `sourceRef`;
- validate slug/version/role and required taxonomy metadata;
- persist complete publisher metadata in the registry and object metadata;
- use server-side registry duplicate/conflict protection;
- avoid silent overwrite;
- permit metadata enrichment/backfill of the same registered source/target without re-exporting/re-uploading the binary;
- return structured outcomes suitable for automation.

The GitHub Action remains a thin validation/transport layer.

## Registry / publication diary

The R2-backed publisher registry is canonical ingestion publication state. The GitHub mirror exists for GPT-readable continuity across sessions.

The registry answers **what was published, from where, and with what ingestion classification**. It does not answer canonical business questions such as entitlement or price.

## Idempotency outcomes

Normal behavior distinguishes:

- **NEW** — revision/role absent and may be published;
- **SKIPPED** — same source/revision/role already exists;
- **CONFLICT** — same target exists with different source or incompatible state;
- **REVIEW_REQUIRED** — safe classification cannot reach automation threshold.

A conflict never silently becomes overwrite.

## Secrets and trust boundary

- Canva client secret, publisher bearer token, and OAuth tokens are never committed;
- runtime secrets belong in Cloudflare encrypted secrets;
- OAuth tokens remain in private Worker state;
- public docs never contain secret values;
- state storage must not be publicly exposed.

## Source-of-truth hierarchy

```text
Founder doctrine
→ WHY / governing invariants

pino-asset-publisher SOP + config + schema + Worker
→ HOW / executable contract

publisher registry
→ WHAT HAS ACTUALLY BEEN PUBLISHED + ingestion classification

future Core AssetDefinition / AssetRevision
→ CANONICAL PRODUCT/BUSINESS MEANING
```

If prose and executable enforcement diverge, stop and reconcile rather than selecting whichever is convenient.
