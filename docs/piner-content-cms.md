# Piner Content CMS — TOS surface

`pino-team-os` is the Founder editing surface for Piner learner/parent product copy. It is **not** the canonical owner of this content.

## Ownership

- Canonical registry, drafts, release history, audit events, and published Piner copy live in `pino-core` D1.
- `pino-team-os` uses its authenticated Founder facade and the private `FounderControlPlane` service binding to manage that Core-owned content.
- Runtime Piner reads the public read-only Core content bundle. It must not read the Founder facade or D1 directly.

## Founder route

`/founder/content/piner`

The editor supports:

- semantic-key search and surface filtering;
- published value vs draft value comparison;
- per-key Save Draft;
- coherent Publish across the full registry;
- release history;
- rollback by creating a new release from an older snapshot.

A saved draft does not change runtime Piner until Publish.

## Content vs behavior

This editor may change learner/parent-facing labels, descriptions, CTA text, helper text, modal copy, locked-state explanation, navigation labels, and similar presentation.

It must not configure eligibility, membership state, booking lifecycle, access policy, progression, authentication, attendance, or capacity. Those remain Core domain behavior.

Internal domain/state names such as `TRIAL_PREMIUM` and `EXPIRED_PREMIUM` may remain unchanged while their learner-facing presentation is configured as `Trải nghiệm` and `Trải nghiệm đã kết thúc`.

## Source fallback

Every registered copy key has a source-controlled fallback in Core. This protects local/degraded rendering and lets runtime return a complete bundle before the first D1 release is published.

## Current prototype boundary

The existing `/piner-prototype` remains the frozen/disposable UI reference and is not rewired through the Founder control plane. Production Piner must consume `GET /v1/piner/content` directly from the public Core boundary and use the matching source fallback per semantic key. This avoids adding another DOM-rewrite layer to the prototype and prevents a private Founder contract from leaking into learner runtime architecture.

The governing architecture decision and approved behavior live in `pino-core`:

- `docs/adr/0016-piner-content-core-d1.md`
- `docs/features/approved/piner-content-cms.md`
