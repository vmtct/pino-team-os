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
 assert.match(diagnostics,/cache:"no-store"/);
 assert.match(diagnostics,/Last seen không phải xác nhận TV đã render\/ACK/);
 assert.doesNotMatch(diagnostics,/method:\s*"POST"|method:\s*"PUT"|method:\s*"DELETE"/);
});
