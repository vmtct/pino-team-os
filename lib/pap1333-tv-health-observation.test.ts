import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeTvHealthObservation,type TvHealthFact } from "./pap1333-tv-health-observation";

const digest="a".repeat(64);
const observation={configSource:"FALLBACK" as const,appliedConfigRevision:0,buildDigest:digest,
  assetStatus:"UNKNOWN" as const,observedAt:"2026-11-02T01:04:42Z",fresh:true as const};
test("PAP-1333 shows honest Fallback v2 revision zero and UNKNOWN asset status",()=>{
 const s=describeTvHealthObservation({observationStatus:"FRESH",latestObservation:observation});
 assert.match(s,/FALLBACK v2 · revision 0/);
 assert.match(s,/assets UNKNOWN/);
 assert.match(s,/không phải renderer ACK/);
 assert.doesNotMatch(s,/READY/);
});
test("PAP-1333 preserves published positive revision and denies forged versions",()=>{
 const published=describeTvHealthObservation({observationStatus:"FRESH",latestObservation:{...observation,configSource:"PUBLISHED",appliedConfigRevision:4,assetStatus:"READY"}});
 assert.match(published,/PUBLISHED v1 · revision 4/);
 assert.match(describeTvHealthObservation({observationStatus:"FRESH",latestObservation:{...observation,configSource:"PUBLISHED",appliedConfigRevision:0}}),/Chưa có observation/);
});
test("PAP-1333 stale or missing observations never advertise past build/assets as current",()=>{
 const stale:TvHealthFact={observationStatus:"STALE",latestObservation:observation};
 assert.match(describeTvHealthObservation(stale),/Observation cũ/);
 assert.doesNotMatch(describeTvHealthObservation(stale),/build /);
 assert.match(describeTvHealthObservation({observationStatus:"NONE",latestObservation:null}),/Chưa có observation/);
});
test("PAP-1333 BO fetch is Center-scoped, read-only and integrated into canonical TVs TDD",()=>{
 const s=readFileSync(new URL("../app/bo/pinoria-tv-operator/TvDeviceDiagnostics.tsx",import.meta.url),"utf8");
 const t=readFileSync(new URL("../app/bo/tvs/TvsTdd.tsx",import.meta.url),"utf8");
 assert.match(s,/api\/bo\/tv\/operator-health\?centerId=/);
 assert.match(s,/describeTvHealthObservation/);
 assert.doesNotMatch(s,/runtimeToken|PINO_TV_SESSION|\/api\/tv\/runtime\//);
 assert.match(t,/<TvHealthReadOnlyPanel centerId=\{center\}/);\n assert.doesNotMatch(t,/app\/bo\/pinoria-tv-operator\/TvDeviceDiagnostics/);
});
