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
