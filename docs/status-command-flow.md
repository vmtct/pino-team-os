# Status command flow

The intended operator flow is:

1. User says `status update` in ChatGPT.
2. ChatGPT triggers the GitHub command bridge.
3. The command bridge starts the Cloudflare Status Bridge for the current `main` SHA.
4. The bridge waits for the matching Cloudflare build to reach a terminal state.
5. It collects build metadata/logs into a GitHub Actions artifact and summary.
6. ChatGPT reads the newest diagnostics and reports the current status.
7. `status update and fix` additionally permits code changes and a PR; it must not auto-merge production.

The status command must never report a stale completed run as a fresh production check. If a fresh Cloudflare run cannot be triggered or the matching build cannot be found, report `STATUS UNKNOWN / CHECK NOT COMPLETED` instead of reusing old diagnostics.
