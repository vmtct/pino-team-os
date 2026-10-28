# PAP-1072 — G2 TDD semantic interaction contracts (incremental)

Jira: https://vmtct97.atlassian.net/browse/PAP-1072
Parent: https://vmtct97.atlassian.net/browse/PAP-1067

## Scope and authority

This slice strengthens the existing shared BO+HO Table/Drawer/Full Detail semantic contract; it does not create a route, business permission, fixture service, new CSS authority, backend API, or production deployment. Tests use local typed in-memory BO/HO fixtures and the real TDD renderer. Grandfathered legacy views retain their existing visual profile. PAP-1073 (G3 measured browser geometry) and PAP-1074 (G4 authenticated Staging) remain separate acceptance gates.

## G2 contract matrix

| Path | Test assertions | Evidence and limit |
| --- | --- | --- |
| Canonical BO/HO Detail | One detail shell/tablist/tabpanel; protected system tabs are first and last; configured business variants; one selected tab; roving tabindex; each aria-controls target is present; selected panel is labelled by its actual tab | `lib/workspace-renderer.test.ts` G2 BO/HO tests, static rendered DOM only |
| Legacy Detail compat | All tabs' aria-controls reference the single mounted active tabpanel, not stale unmounted panel IDs, in every selected tab | `DetailFrame.tsx` bounded one-line repair plus G2 negative control; no CSS/layout change |
| BO/HO permission boundaries | Invalid/missing BO center, cross-surface or denied module read render no record or unauthorized business tab; readonly Drawer has no inline mutation affordance | G2 BO/HO denial tests; backend ACL remains independent |
| Typed Table behavior | Protected identity ordering/visibility, authorized filter operand, registered grouping and page size enforced; valid sort is admitted | G2 query negative/positive assertions against actual `validateQuery`, not an invented adapter |
| Dialog and tab keyboard | Escape closes, Tab and Shift+Tab wrap, editor can retain Escape, Home/End and Arrow navigation follow canonical order, zero-tab boundary safe | G2 event-policy tests + existing `DetailFrame` real handler invocation regression |
| Existing coverage retained | Search and filter, sort/null pagination, Table settings, history status, denied fields, focus/back and request cancellation | Existing workspace-renderer tests; no screenshot/real-browser claim |

## Negative controls

- Regression to legacy per-tab `aria-controls` IDs would fail when inactive tabs reference absent panel IDs.
- Wrong surface or unbound BO Center must not expose a secret test row or business tab.
- Invalid typed Table order/visibility, page size, filter operand or group field must throw before an adapter receives the query.
- An editor popup owns Escape while open; an outer dialog must not steal it.

## Outstanding before PAP-1072 can be Done

- Exercise DOM focus restoration, backdrop focus containment, settings keyboard and screen-reader behavior in a real browser with actual BO/HO authenticated components.
- Include deterministic failure fixtures for detached tabpanel, wrong focus trap, no-readonly state, and unauthorized custom actions at browser integration level, not just static markup assertions.
- Obtain exact-head PR CI success and reconcile any side effects. G3 viewport measurements at 1440/1024/768/390/320 are intentionally owned by PAP-1073; authenticated Staging role/ACL and serving SHA by PAP-1074.
- Do not classify the overall PAP-1067 Epic as complete based solely on these tests.

## Team Surface Decision

```yaml
surface: DUAL
primary_device: DESKTOP
tos:
  app_family: NONE
  entry_context: Shared TDD engine tests; no new TOS entry
  footer_items: []
  theme: Existing
  primary_action: NONE
  capture_requirements: NONE
bo:
  sidebar_group: Existing host-owned
  subnavigation: Existing system-owned Detail
  primary_layout: TABLE
shared:
  permission_context: Existing BO Center-scoped / HO authorized global context; no grant changes
  cross_domain_links: NONE
founder_layout_review: APPROVED
```
