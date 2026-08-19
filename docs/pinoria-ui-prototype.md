# Pinoria Full UI Prototype — Founder Review

Status: **prototype only**. This branch is intentionally mock-data and interaction-only. It does not implement Core, D1, Notion, reward, progression, access-control, or TV runtime business behavior.

This follows `AGENTS.md` prototype discipline: product findings from this UI must be reconciled into the canonical `pino-core` spec before runtime implementation.

## Terminology lock

Across PINO operational surfaces, use **Check-in** and **Check-out** exactly as written. These two terms are not localized into Vietnamese. TV presentation scenes remain **Chào đến** and **Chào về** because they describe what the learner sees, not the underlying presence command.

## Run locally

```bash
git fetch origin
git switch prototype/pinoria-full-ui-v1
npm install
npm run dev
```

Open:

- Founder Pinoria workspace: `http://localhost:3001/founder/pinoria` when using the PINO Local Platform port convention, or the port printed by `npm run dev` when running this repo alone.
- Pinoria TV directly: `/pinoria-tv`.

The production direction is for TOS and Pinoria TV to be independent clients. The current prototype includes an in-memory relay so a staff browser can issue Check-in/Check-out while the reception TV runs independently on the fixed laptop.

## Prototype coverage

### Pinoria Ops
- Live House / current presence
- Check-in / Check-out workflow
- attention-before-Check-out
- Pending Arrival Choices and async resolution
- learner Pinoria profile
- Character / Showcase / resources / effects
- Feed Companion
- Companion Ritual
- Hạt / Phép / Mirror entitlement representation
- Physical Fulfillment
- Physical Chest batch logging concept
- TV runtime status / Return to Ambient / replay / queued presentation
- Staffing Guard for presence permissions, staff presence, and operating window

### Pinoria Studio
- Milestones & Journey architecture
- Entry / Conversion / Retention / Expansion / Achievement semantics
- Reward Packages and Grant Policies
- Companion Progression Assets
- Companion Progression Policies
- Active Companion rotation suggestion configuration
- Companion species / materialization
- Shop / learner holdings / digital supply / physical inventory distinction
- World & Campaigns
- shared objectives / contribution policies / world-state simulation
- World News / lore / discovery
- Content Library / Artifact Family / readiness / preview
- Projection Policies
- History / correlation trace / corrections / diagnostics
- Founder `Create Journey` composed workflow

### TV review surfaces
- Ambient House
- Chào đến / Arrival Spotlight
- Quick Choice
- Companion Materialization Ritual
- Chào về / Departure Reveal
- World News / Artifact discovery

The TV review controls are deliberately visible in prototype mode only. A production TV client would not expose them.

## Founder sign-off questions

1. Does the **Ops vs Studio** split match how reception, manager, and Founder should think about Pinoria?
2. Is `Live House` the right operational home rather than a dashboard?
3. Are Check-in Choice and Check-out attention flows light enough for reception?
4. Does the learner profile make `Character = self`, `Companion = relationship`, and `Showcase = achievement/history` clear?
5. Is Companion progression understandable without a manual level setter?
6. Does Founder configuration feel like product configuration rather than database administration?
7. Are Milestones / Reward Package / Artifact Family / Next Journey sufficient to express retention and specialization upsell without sales copy on the child-facing TV?
8. Does the Content Library make new content feel publishable without code when behavior stays inside a supported capability class?
9. Does Campaign simulation communicate a shared world rather than a leaderboard?
10. Is the TV experience calm, theatrical, and understandable at reception distance?
11. Does the independent-client model work for staff phone/browser + fixed reception TV?
12. What UI/product decisions changed during review? Those become the final inputs to the Core handoff spec.

## Explicit non-authority

This prototype must not be used as evidence that backend schemas, API routes, permission strings, Core ownership, or runtime integration are approved. No production deployment or merge is authorized by the existence of this branch.
