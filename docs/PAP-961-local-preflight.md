# PAP-961 — Local Preflight

Before pushing a PR, from the active owner worktree run:

    npm run preflight:local

Checks Git unfinished operations/whitespace, changed JS syntax, Core filesystem test runner naming, changed GitHub Actions YAML through actionlint, local TypeScript tooling and changed tests only. For workflow changes actionlint must be installed; optionally set PINO_ACTIONLINT to a verified executable.

The command does not push, merge, deploy, open a browser, mutate D1 or install hooks. Hook activation is a separate owner-controlled operation at a verified safe boundary. A local PASS never replaces exact-head GitHub CI, PAP-507 review status, PAP-185 production admission, migration backup/restore proof, or runtime security acceptance.

Limitations: actionlint does not detect missing runtime secrets or same-step GitHub Actions env scope bugs; workflow-specific tests remain mandatory for sensitive migration workflows. Dependency failure is reported as tooling missing, not product failure.

To enforce the preflight for ONE push without changing shared worktree Git config:

    git -c core.hooksPath=.githooks push origin HEAD

Do not globally set core.hooksPath on a shared multi-worktree checkout: it may unexpectedly affect FC1/FC2 writers. Enable persistent hooks only through a separately reviewed per-worktree installation/owner handoff.
