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

It is canonical for asset-ingestion and storage-addressing rules used by that tooling. It does **not** define PINO Core business semantics, inventory rules, pricing, rarity, campaign eligibility, learner entitlement, or other shared domain behavior.

If an implementation detail in `pino-asset-publisher` conflicts with this doctrine, the implementation must be reconciled to this doctrine before normal publishing continues.

## Decision classification

Under the Founder Policy Center classification model, the rules in this document are primarily:

- `INVARIANT` — stable ingestion/storage rules that ordinary publishing must not reinterpret;
- `DEPLOYMENT_CONFIG` — technical secrets, endpoints, bindings, and environment configuration.

They are not ordinary mutable business `POLICY` entries and must not be exposed as generic Founder Policy Center settings.

## Separation of concerns

The asset system has three distinct layers:

```text
R2 path
→ where the binary file physically lives

Import metadata
→ where the file came from and what ingestion role it represents

Core asset metadata
→ what the asset means to PINO business/product domains
```

Do not collapse these layers.

### R2 physical storage

R2 storage paths must remain semantically thin and stable.

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

Physical paths must not encode mutable business taxonomy such as:

- audience (`learner`, `staff`, `universal`);
- cosmetic slot (`headwear`, `hair`, `body`, etc.);
- rarity;
- price;
- campaign;
- entitlement;
- product category.

A metadata change must not require moving R2 objects merely to keep a path semantically truthful.

### Import metadata

The publisher may retain ingestion metadata required for provenance and idempotency, including:

- source provider;
- Canva design ID;
- Canva page ID;
- page number at publication time;
- asset slug;
- version;
- role;
- physical object path;
- publication timestamp.

Import metadata is not canonical business metadata.

### Core asset metadata

Business/product classification belongs to Core/D1 when the canonical AssetDefinition / AssetRevision capability exists.

Examples include:

- family;
- audience;
- slot;
- presentation tags;
- registration profile;
- rarity;
- price;
- campaign;
- animation preset;
- entitlement semantics.

Frontend configuration is not the canonical owner of those semantics.

## Canva source identity

Canva is an artwork source, not the canonical product database.

For source tracking:

- `designId + pageId` is the stable source identity;
- page number is only a convenience/debug value and may change as pages are inserted, removed, or reordered;
- a GPT/operator must not treat page number alone as permanent identity.

## Asset identity

`asset-slug` is a stable, human-readable storage identity.

Rules:

- lowercase kebab-case;
- do not encode mutable taxonomy in the slug;
- prefer semantic object identity (`birthday-hat`, `star-glasses`, `hologram-wings`);
- avoid sequence-only names such as `accessories-01` unless the object genuinely has no meaningful identity;
- slugs are not Core opaque entity IDs.

## Revision/version rules

Versions use zero-padded storage versions:

```text
v001
v002
v003
```

A production revision is immutable in intent.

After a revision has been successfully published:

- materially changed artwork must normally use the next version;
- the publisher must not silently replace a published revision with a different source/artwork;
- a same-version repair is allowed only for an explicit technical repair/republication of the intended same revision.

## Asset roles

A revision may contain one or more roles.

Initial canonical roles include:

- `layer` — composable runtime layer aligned to its registration/canvas contract;
- `standalone` — prominent centered presentation representation of the same asset revision;
- `idle` — standalone idle representation where appropriate for companions/characters.

Additional roles must be added to the publisher's canonical machine contract before use. GPT sessions must not invent role names ad hoc.

`layer` and `standalone` are different representations of the same asset revision when they share the same slug and version.

## GPT/operator contract

Normal publishing may be initiated conversationally, including by the convention:

> `asset ready, bắt đầu upload đi`

Any GPT/operator executing the flow must:

1. read the latest publisher SOP and machine config/schema from `vmtct/pino-asset-publisher`;
2. inspect the current Canva source pages;
3. read current publisher registry/state before deciding what is new;
4. use Canva `pageId` for duplicate/source identity checks;
5. choose only allowed role/category values from the repository contract;
6. never invent an R2 route;
7. submit a structured publish request rather than uploading files manually;
8. verify the Worker result;
9. report published, skipped, conflict, and review-required results separately.

Conversation memory is not authoritative when it conflicts with the repository contract or registry.

## Server enforcement

Critical invariants must be enforced by the Worker, not only described in GPT instructions.

The Worker must:

- derive the physical R2 object path from `slug + version + role`;
- reject caller-supplied arbitrary object paths in the canonical request contract;
- validate slug/version/role format;
- reject unsupported roles;
- use a server-side registry for duplicate/conflict protection;
- avoid silent overwrite of an existing logical revision/role;
- return structured outcomes suitable for automation.

The GitHub Action should remain a thin transport/validation layer and must not become the canonical business classifier.

## Registry / publication diary

The publisher registry is the canonical record of what the ingestion tool has successfully published.

It should record at minimum:

```text
slug
version
role
object path
source provider
Canva designId
Canva pageId
page number at publication time
publishedAt
```

The registry answers **what has been published**. It does not answer business/product questions such as who can equip the asset or how much it costs.

## Idempotency and conflicts

Normal publish behavior must distinguish:

- **NEW** — revision/role does not exist and can be published;
- **SKIPPED** — the same source/revision/role is already published;
- **CONFLICT** — the same slug/version/role exists with a different source identity or incompatible state;
- **REVIEW_REQUIRED** — classification/source confidence is insufficient for safe automated publication.

A conflict must not silently become an overwrite.

## Secrets and trust boundary

Secrets are deployment configuration, not documentation content.

- Canva client secret, publisher bearer token, and OAuth tokens must never be committed to GitHub;
- runtime secrets belong in Cloudflare Worker encrypted secrets;
- Canva access/refresh tokens remain in the Worker's private state storage;
- public documentation must never include secret values;
- the R2 state bucket must never be publicly exposed.

## Source-of-truth hierarchy

For this workflow:

```text
Founder doctrine (this document)
→ WHY / governing invariants

pino-asset-publisher SOP + config + schema + Worker
→ HOW / executable contract

publisher registry
→ WHAT HAS ACTUALLY BEEN PUBLISHED

future Core AssetDefinition / AssetRevision
→ WHAT THE ASSET MEANS TO PINO
```

If prose and executable enforcement diverge, stop normal publishing and reconcile the divergence rather than choosing whichever is convenient.

## Implementation references

Implementation repository:

```text
vmtct/pino-asset-publisher
```

Expected operational entry point:

```text
docs/CANVA_ASSET_WORKFLOW.md
```

Expected machine contracts:

```text
config/asset-storage.v1.json
config/asset-taxonomy.v1.json
config/asset-policy.v1.json
schemas/publish-request.v2.schema.json
```
