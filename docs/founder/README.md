# Founder Docs

This folder contains Founder-approved canonical Markdown documents that may later be projected read-only into a Founder-facing Team OS / Back Office documentation surface.

## Source-of-truth rule

The Markdown file in this folder is the canonical document. A UI page that renders it is only a projection and must not become a second editable copy.

For each Founder document:

```text
canonical Markdown in repository
→ read-only Founder Docs projection
→ links to implementation repositories/contracts where applicable
```

Do not duplicate the same doctrine in React constants, CMS fields, Notion, or another repository merely for display.

## Relationship to Founder Policy Center

Founder Docs and Founder Policy Center are distinct concepts.

- **Founder Docs**: read-only approved doctrine, architecture decisions, operating principles, and other canonical prose.
- **Founder Policy Center** (`pino-core` feature `policy-center`): effective-dated mutable business `POLICY` governance owned by Core/domain contracts.

A document classified primarily as `INVARIANT` or `DEPLOYMENT_CONFIG` must not be converted into an editable Policy Center entry simply because a Founder wants to read it in the same control-plane area.

## Current canonical documents

- `asset-publishing-doctrine-v1.md` — governing doctrine for `vmtct/pino-asset-publisher` Canva → R2 ingestion tooling.

## Intended projection

A future read-only Founder Docs surface may expose documents under a route such as:

```text
/founder/docs
```

The projection should read/version the canonical repository documents and display status, version, updated date, and implementation references.

Runtime UI implementation must follow `AGENTS.md` governance and the approved Team OS surface architecture. This folder alone does not authorize new navigation or protected runtime behavior.
