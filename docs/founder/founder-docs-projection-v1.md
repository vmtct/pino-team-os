# Founder Docs Projection v1

Status: **PROJECTION DESIGN — NO RUNTIME AUTHORITY**

Purpose: define how canonical Markdown documents under `docs/founder/` may later be rendered read-only inside PINO Team without creating a second source of truth.

## Team Surface Decision

```yaml
Team Surface Decision

surface: BO
primary_device: DESKTOP

tos:
  app_family: NONE
  entry_context:
  footer_items: []
  theme:
  primary_action:
  capture_requirements:

bo:
  sidebar_group: System
  subnavigation: [Founder Docs]
  primary_layout: NONE

shared:
  permission_context: inherit the existing protected Founder/BO surface gate; this projection adds no domain mutation capability
  cross_domain_links: [vmtct/pino-asset-publisher]

founder_layout_review: APPROVED
```

This placement inherits the approved BO `System` grouping direction from `docs/tos-adaptive-workspace-doctrine-v1.md`. It does not add a new TOS app family or navigation model.

## Canonical source

The canonical documents are registered in:

```text
docs/founder/index.json
```

The Markdown path referenced by each registry entry is the source of truth.

The runtime projection must not maintain an independently editable copy of document content.

## Intended routes

```text
/founder/docs
/founder/docs/<document-id>
```

The list page should show at minimum:

- title;
- canonical status;
- version;
- decision classification;
- implementation repository references.

The detail page should render the canonical Markdown read-only.

## Relationship to Policy Center

Founder Docs is not the `policy-center` runtime feature.

The approved Core Policy Center governs effective-dated mutable domain `POLICY` records. Founder Docs renders canonical prose such as doctrines and invariants. A document may explain Policy Center classification, but its presence here does not convert it into editable policy state.

## Build/projection rule

Preferred implementation is a deterministic build-time projection from `docs/founder/index.json` + the referenced Markdown files.

Do not hand-copy doctrine text into React components.

If generated projection artifacts are needed by the build, mark them generated and derive them automatically from the canonical Markdown before `next build`.

## Release gate

This document authorizes the projection design only. Runtime UI/deployment remains a separate implementation/release action under repository governance.
