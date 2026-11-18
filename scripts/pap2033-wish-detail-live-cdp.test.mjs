import test from "node:test";
import assert from "node:assert/strict";
import {contracts,validate} from "./pap2033-wish-detail-live-cdp.mjs";
const id="019a0000-0000-7000-8000-000000000001",other="019a0000-0000-7000-8000-000000000002";
const env={PAP1912_DETAIL_G4:"1",PAP2033_KIND:"policy",PAP1912_SERVED_SHA:"a".repeat(40),PAP2033_CORE_SHA:"b".repeat(40),PAP1912_DEPLOYMENT_ID:"team",PAP2033_CORE_DEPLOYMENT_ID:"core",PAP2033_RECEIPT:"verified source record",PAP2033_RECORD:id,PAP2033_ROW_LABEL:"QA Wish"};
test("Wish runner fails closed without explicit admission or pinned fixture/deployments",()=>{
 for(const patch of [{CI:"true"},{PAP1912_DETAIL_G4:"0"},{PAP2033_KIND:"unknown"},{PAP1912_SERVED_SHA:"a"},{PAP2033_CORE_DEPLOYMENT_ID:""},{PAP2033_RECORD:"bad"},{PAP2033_ROW_LABEL:""}])assert.throws(()=>validate({...env,...patch}));
 assert.equal(validate(env).c.port,9337);
});
test("BO scope needs separate actor, Center and actual foreign Center",()=>{
 const bo={...env,PAP2033_KIND:"event",PAP2033_CENTER:id,PAP2033_ACTOR:id,PAP2033_FOREIGN_CENTER:other};
 assert.equal(validate(bo).origin,"https://bo.staging.pinohouse.art");
 assert.equal(validate(bo).c.port,9335);
 assert.throws(()=>validate({...bo,PAP2033_FOREIGN_CENTER:id}));
 assert.throws(()=>validate({...bo,PAP2033_ACTOR:""}));
 assert.deepEqual(contracts.banner.tabs.map(x=>x[0]),["overview","items","history"]);
});
