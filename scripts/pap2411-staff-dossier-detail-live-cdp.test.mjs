import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ROOT,inspectConsumer} from "./pap1912-detail-parity.mjs";
import {validate,tabs} from "./pap2411-staff-dossier-detail-live-cdp.mjs";
const env={PAP1912_DETAIL_G4:"1",PAP1912_SERVED_SHA:"a".repeat(40),PAP1912_DEPLOYMENT_ID:"synthetic-receipt",PAP2411_QA_RECEIPT:"synthetic-lease",PAP2411_QA_PORT:"9342",PAP2411_ACTOR:"00000000-0000-4000-8000-000000000001",PAP2411_CENTER:"00000000-0000-4000-8000-000000000002",PAP2411_RECORD:"00000000-0000-4000-8000-000000000003",PAP2411_ROW_LABEL:"QA synthetic"};
test("PAP-2411 G4 requires explicit existing fixture, exact serving receipt and i3 lease; CI denied",()=>{assert.equal(validate(env).port,9342);for(const patch of [{CI:"1"},{PAP1912_DETAIL_G4:"0"},{PAP2411_QA_PORT:"9335"},{PAP2411_RECORD:"STAFF-MOCK"},{PAP2411_QA_RECEIPT:""},{PAP1912_SERVED_SHA:"abc"}])assert.throws(()=>validate({...env,...patch}));});
test("PAP-2411 real DetailFrame registered exact tabs; drift rejected",()=>{const file="app/bo/staff/StaffRegistrationReviewQueue.tsx",source=fs.readFileSync(ROOT+"/"+file,"utf8"),entry=JSON.parse(fs.readFileSync(ROOT+"/config/pap1912-detail-parity.json","utf8")).consumers.find(e=>e.file===file);assert.deepEqual(entry.tabs.map(t=>t[1]),tabs);assert.deepEqual(inspectConsumer(file,source,entry,[]),[]);assert.ok(inspectConsumer(file,source.replace('id: "history"','id: "drift"'),entry,[]).some(e=>e.includes("business tab IDs/labels drift")));});
