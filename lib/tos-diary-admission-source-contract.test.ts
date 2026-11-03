import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

test("PAP-1400 TOS UI requires source-projected opening before any write admission",()=>{
 const ui=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/DiaryCapturePanel.tsx"),"utf8");
 const core=readFileSync(resolve(process.cwd(),"lib/tos-classroom-v18b-api.ts"),"utf8");
 assert.match(core,/export const V18B_WRITE_ADMITTED=false;/);
 assert.match(ui,/const UI_RELOAD_RECOVERY_ADMITTED=false;/);
 assert.match(ui,/model\.openingReadState==="LOADED"/);
 assert.match(ui,/Boolean\(model\.data\.openings\[classroom\.id\]/);
 assert.match(ui,/writeAdmitted=V18B_WRITE_ADMITTED&&UI_RELOAD_RECOVERY_ADMITTED&&openingFromCore/);
 assert.doesNotMatch(ui,/model\.openingReadState!=="LOADED"\|\|/);
});

test("PAP-1400 original Register ticket is stored BEFORE network, no automatic re-Register on unknown receipt",()=>{
 const ui=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/DiaryCapturePanel.tsx"),"utf8");
 const source=readFileSync(resolve(process.cwd(),"lib/tos-diary-register-receipt-recovery.ts"),"utf8");
 const stage=ui.indexOf("stageDiaryTicket(storage,prepared.submissionKey)");
 const register=ui.indexOf("createDiaryObservationWithLinks(tosClassroomV18bApi");
 assert.ok(stage>=0&&register>stage,"opaque ticket must be stored before POST");
 assert.match(ui,/reconcileUnknownDiaryRegister\(tosClassroomV18bApi/);
 assert.match(ui,/clearVerifiedDiaryTicket\(ticketStorage\(\),registerTicket\.key\)/);
 assert.match(ui,/registerTicket\.state!=="EMPTY"/);
 assert.doesNotMatch(ui,/localStorage/);
 assert.doesNotMatch(ui,/sessionStorage\.setItem/);
 assert.doesNotMatch(source,/\.register\(/);
 assert.doesNotMatch(source,/\.saveDraft\(/);
 assert.doesNotMatch(source,/\.linkMission\(/);
});
