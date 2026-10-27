# PAP-1032 — Staging-only Payroll Read Acceptance Fixtures
2026-10-27 · STATUS: FIXTURE_SPEC_READY / STAGING_WRITE_NOT_ADMITTED

## Contract & separation
- This document is NOT a deployed or seeded fixture.
- Never use real/current Staff pay histories or existing Center operations. All IDs originate from admitted Core create/read APIs and have test-only metadata PAP1032-READ-20261027.
- Writer: authorized HO synthetic actor for effective-date compensation rate; authorized BO synthetic Center Manager for timekeeping and payroll operations. BO cannot write HO rates.
- Shared staging single-writer/DB admission before any fixture write. No Production, messaging, OTP, email, SMS, Zalo, payments or outbound.
- Real read acceptance blocked until actual permissions/actors/fixtures are admitted; never use browser mocks to replace API data.

## Minimum isolated test topology — canonical IDs assigned by API
- One synthetic Center PAP1032 QA Center, no enrolled real persons; record canonical Center id/timezone.
- Synthetic PTE A: complete Timekeeping, effective HO rate 25,000 VND/h; DRAFT; amount read from Core.
- Synthetic PTE B: completed hours + immutable FINALIZED snapshot, HO rate 32,000 VND/h; only seed after explicit irreversible ledger retention approval. Changing HO rate must not recalc snapshot.
- Synthetic PTE C: check-in but missing checkout; PENDING, no finalized payable amount.
- Synthetic PTE D: complete Timekeeping but HO rate missing; missing-rate status, no invented money.
- Synthetic PTE E: shift assignment only without clock events; MUST NOT appear as actual work in settlement grid.
- One period covering A–E; one entirely empty period; one period beginning February 2027 and ending March 2027 (expect Lương tháng 2 - PAP1032 QA Center). Avoid overlaps.

## Authenticated staging acceptance
1. Authenticated Founder/BO Manager Center-scoped GET list, get period, staff-rollup, and specific preview; negative 401/403 and cross-center deny.
2. Browser read path GET-only, zero POST/PATCH/DELETE.
3. TWO totals use Core FULL_PERIOD: expected knownMinor; finalized finalizedMinor+paidMinor; no double count, no fake amounts.
4. Name follows startDate month and canonical Center displayName, not stored legacy name or endDate.
5. Shared BO V2.5 DS Table/Quick View/Full Detail; separate Quyết Toán tab; 2 KPIs ABOVE 1-row-per-PTE grid; empty states and no prototype banners; responsive 390/768/1440.
6. Keep receipts center/staff IDs, actor role, D1 ledger, API statuses and request correlation, CI run, Worker serving SHA, cleanup/readback.

## Proven gating dependency / external admission
- Core PayrollPeriodRollupService union currently includes workforce_shift_assignments, so totalStaffCount DOES NOT prove recorded Timekeeping. Need Core attendance-evidence flag/authorized read projection to include PTE with check-in but pending checkout and exclude assigned-only PTE. Client read model conservatively includes paid-minute/finalized evidence only, cannot claim full missing-checkout parity.
- Core PR #1849 is DRAFT; last confirmed staging contains no HO rate history, zero finalized settlements and zero Payroll grants. Read-only UI may ship independently but cannot be Founder data-accepted without real authorized fixture.
- Financial FINALIZED is immutable. Record explicit retention or isolated reversible test strategy before writing it; otherwise seed DRAFT-only and STOP at external wait.
- Cleanup only fixture-tagged reversible data, reverse FK order, and prove no real Center/Staff/grant changes.

## External wait boundary
WAIT_EXTERNAL_FIXTURE_ADMISSION until staging writer lease + authorized HO actor/grants + immutable retention decision + Core attendance-evidence contract are resolved. No direct Cloudflare privileged SQL bypass.
