import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=(relative:string)=>fs.readFileSync(new URL("../"+relative,import.meta.url),"utf8");

test("PAP-659 BO TV operator reuses Core-authorized commands, not TV public relay",()=>{
 const page=source("app/bo/pinoria-tv-operator/page.tsx");
 const queue=source("app/pinoria/tv-operator/TvOperatorQueue.tsx");
 assert.match(page,/TvOperatorQueue/);
 assert.match(queue,/operatorPresentationClient\.queue/);
 assert.match(queue,/operatorPresentationClient\.replayDispatch/);
 assert.match(queue,/operatorPresentationClient\.returnToAmbient/);
 assert.match(queue,/operatorPresentationClient\.close/);
 assert.doesNotMatch(page,/claimPresentation|completePresentation/);
});
test("PAP-659 diagnostics is explicit read-only BO status, never a physical ACK",()=>{
 const page=source("app/bo/pinoria-tv-operator/page.tsx");
 const diagnostics=source("app/bo/pinoria-tv-operator/TvDeviceDiagnostics.tsx");
 assert.match(page,/TvDeviceDiagnostics/);
 assert.match(diagnostics,/\/api\/bo\/tv\/devices/);
 assert.match(diagnostics,/\/api\/bo\/tv\/displays/);
 assert.match(diagnostics,/definitionVersion/);
 assert.match(diagnostics,/runtimeType/);
 assert.match(diagnostics,/cache:"no-store"/);
 assert.match(diagnostics,/Last seen không phải xác nhận TV đã render\/ACK/);
 assert.doesNotMatch(diagnostics,/method:\s*"POST"|method:\s*"PUT"|method:\s*"DELETE"/);
});

test("PAP-659 BO diagnostics never leaks TV runtime bearer or treats heartbeat as render acknowledgement",()=>{
 const diagnostics=source("app/bo/pinoria-tv-operator/TvDeviceDiagnostics.tsx");
 assert.doesNotMatch(diagnostics,/\/api\/tv\/runtime\/|runtimeToken|PINO_TV_SESSION/);
 assert.match(diagnostics,/không suy diễn từ Last seen/);
 assert.match(diagnostics,/displays\?\.find/);
});

test("PAP-659 health read uses only centers returned by authorized device lookup",()=>{
 const diagnostics=source("app/bo/pinoria-tv-operator/TvDeviceDiagnostics.tsx");
 assert.match(diagnostics,/allowedCenters\.includes\(centerId\.trim\(\)\)/);
 assert.match(diagnostics,/allowedCenters\.length===1\?allowedCenters\[0\]:null/);
 assert.match(diagnostics,/operatorHealth=await operatorPresentationClient\.operatorHealth\(selectedCenter\)/);
 assert.match(diagnostics,/catch\(cause\).*setError/);
 assert.match(diagnostics,/<select aria-label="Center for operator health"/);
 assert.doesNotMatch(diagnostics,/<input aria-label="Center ID for operator health"/);
});
test("PAP-659 diagnostics prevents overlapping refresh",()=>{const diagnostics=source("app/bo/pinoria-tv-operator/TvDeviceDiagnostics.tsx");assert.match(diagnostics,/refreshInFlight\.current=true/);assert.match(diagnostics,/if\(refreshInFlight\.current\)return/);assert.match(diagnostics,/finally\{refreshInFlight\.current=false/);});
