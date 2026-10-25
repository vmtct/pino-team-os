# PAP-979 — registration design system staging checkpoint

Founder supersedes the former fullstack checkpoint: BO UI skeleton first, with
Students as the only read-only business-data table. Merge and staging release
are explicitly authorized. Production and PAP-971 outbound remain HOLD.

The **sole styling authority is Hồ sơ đăng ký**, specifically `playground.html`
in `PAP-879-BO-V2.5-FULLDETAIL-20261024/source`. Students, Classes and the older
`index.html` / `app.js` are not styling references.

## Implementation

The previous React runtime composed its own presentation and had drifted from
the approved registration CSS/renderers. For this deliberately UI-only checkpoint,
`/bo-skeleton/playground.html` serves the registration source through the existing
server-side BO authorization gate. Its six CSS dependencies, HTML and JS are
vendored byte-for-byte with SHA-256 hashes in
`public/bo-authority-source/manifest.json`. No new CSS is authored.

Three checked seams in the served JS supply existing BO navigation **data**, a
Students property-key list, and a behavior/data bridge before bootstrap. All
shared markup/rendering remains the registration renderer. Missing/drifted seams
fail closed. No renderer from another module is used. Existing React/Gate A code
is retained for subsequent integration work; the staging-only flag selects this
checkpoint without activating it on production or TOS.

Students uses authenticated `GET /api/bo/learners` with canonical cursor IDs,
complete-page validation and no mock fallback. It displays only returned facts.
There are no writes, live subject History, lifecycle, class, subscription or
Shared Views persistence integrations. History explicitly says it is unwired for
real student IDs. Other modules are labeled prototype examples using the
registration skeleton and synthetic registration records; their content is not
a claim of implemented domain behavior. View/settings changes remain local,
non-persistent prototype interactions.

## Verification

`node --import tsx scripts/verify-bo-skeleton.mjs` compares the registration
workspace table, drawer, three Full Detail tabs and settings at 390/768/1440px
against the immutable local authority. Eighteen screenshots must match exactly.
It also captures full shells and the Students/Classes surfaces, checks Students
pagination, exercises property filtering and verifies 403/409 fail closed with
no synthetic fallback. Every business API request must be Students GET only.

`lib/bo-skeleton.test.ts` verifies hashes, the six canonical stylesheet imports,
absence of authored style declarations, production/TOS exclusion, source drift,
authentication/ACL denial, asset allowlist and private no-store responses.

Local fixtures are not staging acceptance. CI retains all screenshots in the
PAP-979 artifact. Authenticated staging verification and Cloudflare serving
version/SHA evidence are recorded separately in PAP-979 after release.

## Release

`pap979-ui-only-staging.yml` only admits this branch's merged PR on exact current
main with successful push CI. It uses the shared Team staging writer concurrency,
compares both Team/Core serving versions before deploy, records exact SHA/version,
checks unauthenticated denials and protects rollback against concurrent writers.
It deploys Team staging only, using existing staging Core service bindings.
No D1/R2 operations, fixture migrations, auth bypass, outbound sends or production
traffic promotion. Previous Team staging version is retained as rollback evidence.

`INDIE_WAIVED_BY_FOUNDER` — PAP-507. No self-review is represented as independent.

```yaml
Team Surface Decision:
  surface: BO
  primary_device: DESKTOP
  tos:
    app_family: NONE
    entry_context: none
    footer_items: []
    theme: none
    primary_action: none
    capture_requirements: none
  bo:
    sidebar_group: existing BO grouped IA, data only
    subnavigation: registration design system
    primary_layout: TABLE
  shared:
    permission_context: canonical team.bo.access; student.profile.view for Students GET
    cross_domain_links: none
  founder_layout_review: APPROVED
```
