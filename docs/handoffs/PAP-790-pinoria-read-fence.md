# PAP-790 — Staff Pinoria Self / House presence / onboarding

Source: PAP-779/PAP-790, Team OS canonical PINO Staff Pinoria projection. Existing Pinoria tab already rendered actual Person/Self/Character/loadout and TimekeepingSession-derived presence and one-time onboarding ceremony without fake identity provisioning or client-side presence toggle.

Change: canonical `boApi.staffPinoria` and `boApi.staffPinoriaOnboarding` are now fetched lazily only when selected Staff has full-detail Pinoria tab open. Staff directory / Overview / other tabs no longer automatically fetch Pinoria. Read-generation fence invalidates asynchronous responses whenever Staff/tab changes or refresh supersedes a request. Manual refresh and grant/revoke ceremony update only current visible target; Core continues to enforce authorization and ceremony semantics. Loading/error/no-Self/no-character/absent-presence fallbacks remain.

Local proof: 2/2 focused gate/fence tests PASS; TypeScript noEmit PASS; targeted ESLint 0 errors with pre-existing hook refresh dependency warning; diff check PASS. Exact-head GitHub CI after PR. No authenticated BO/Core or visual/manual Production verification claimed; optional premerge per PAP-512.

FC1 sole MERGER. Re-read current main and StaffManagementView conflict ownership with PAP-783/784/785/787/788/789/791, verify exact-head CI, PAP-507 waiver, staging CD disabled, security and merge SHA. No staging/Production/D1 actions in this DEV lane.
