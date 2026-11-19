# PAP-2198 · Surface regression on i5

From pino-team-os, after npm ci:

    node qa/run.mjs bo local
    node qa/run.mjs ho local person
    node qa/run.mjs tos list

Each feature owns one JSON file under cases/<surface>. Its tests run as a group and return a separate result and elapsed time. local runs offline contract tests in Node. Add a path to an existing business test there. Every selected group runs, even if a prior group failed.

For a native BO/HO M1 preview set PINO_QA_PREVIEW_FIXTURES to a local JSON file, then run `node qa/run.mjs bo preview payroll-daily`. Use the feature keeper's actual route and synthetic data. A missing fixture yields NOT_RUN and a nonzero exit. Example entry:

    {"bo/payroll-daily":{"url":"http://192.168.1.6:12345/bo/payroll-daily","row":"QA staff","drawer":"QA staff","detail":"QA staff","drawerFields":{"workDate":"19/11/2026"}}}

The row and expected values must identify the exact approved fixture. drawerFields and detailFields bind expectations to individual native data-tdd-field containers. The local browser closes after the case. This command requires the repository's Playwright Chromium installation.

Staging operations use the existing i5 JIT profile admission (PAP-184 #43502 and #44014). An admitted feature runner can call checkTdd(page, fixture) on its own test page. Keep authorized actor, selected Center, serving revision, read-only routing, cleanup and release in the admitting runner. Local results never certify live G4.

For an already admitted Staging job import runStaging from staging.mjs. Supply surface, cases, the platform operator's withProfile(profile, callback) and verify(page, profile, item). withProfile must own the real JIT acquisition and release around the callback. verify must return authenticated actorId, scope (selected Center or explicitly permitted global scope), authorized, coreSha and teamSha from the official readbacks. Each case supplies key, path, expected actorId and scope plus a TDD fixture or a read-only run(page) journey. One attach serves the batch, one new tab per case. BLOCKED leaves remaining cases NOT_RUN. This adapter has not been certified with live credentials. Do not supply simulated admission or serving proofs on Staging.

BO Manager list batches use runPayrollListBatch from bo-payroll-staging.mjs. Pass features (for example ["payroll-daily","payroll-exceptions"]), actorId, centerId, withProfile and readServing. Each feature declares its native route, data-pap-ticket and list endpoint in stagingList in its own manifest. A visible table with a server alert fails the positive read case. The optional observe callback receives only HTTP statuses, counts and DOM flags. A successful list smoke does not cover Drawer, Detail or write flows.

## Local QA Service V1 (offline regression only)

Node 24 on i5; built-in node:sqlite. Use a dedicated clean, reviewed, committed
worktree and an absolute local database path outside the repository.
Only registered local suites are accepted, not commands, URLs, credentials
or authenticated staging jobs. It calls the existing master with mode local.

    node qa/service/worker.mjs D:\pino-e2e-evidence\qa-local-v1\queue.db enqueue bo student
    node qa/service/worker.mjs D:\pino-e2e-evidence\qa-local-v1\queue.db work-once
    node qa/service/worker.mjs D:\pino-e2e-evidence\qa-local-v1\queue.db list

Omit feature to select all manifest groups for that surface. A job is pinned
to the clean source's full commit SHA; identical selection and SHA returns
the existing job, including terminal outcomes. Single offline claim is atomic
within the same database; this does not lock live QA profiles. An abandoned
RUNNING job remains held for explicit operator reconciliation: no automatic
retry, reclaim, or forced termination. No recovery command in V1.
A dirty or changed source invalidates evidence. Complete ordered per-group
results and matching process exit are required. Raw test stdout is not
persisted; absent results or runner errors block. Receipts are LOCAL_ONLY,
never G4 or business acceptance.

    node --test qa/service/service.test.mjs

V1 is an on-demand worker, not a network listener or installed scheduler.
Automatic CD trigger, Jira API callback and live QA are not implemented.
Existing SOP and execution restrictions remain in force.

### Pipeline observer (LOCAL_ONLY)

An independent GitHub-hosted workflow observes completed successful Team Staging
CD (Guarded) on trusted main. It downloads the exact CD receipt, checks the run
and version identifiers and clean checked-out revision, enqueues all three
registered surface suites and uploads a sanitized JSON report. This is offline
source regression after CD, not a live deployment check, release gate or G4.
It does not hold the deployment slot or roll back staging. PRs touching service
code run only the contract tests. The same pipeline.mjs is usable on a dedicated
reviewed i5 checkout with actual trusted CD receipt and GitHub run metadata;
automatic i5 scheduler activation and credentialed Jira callback are not part of
this increment. No self-hosted runner or authenticated browser is used.
