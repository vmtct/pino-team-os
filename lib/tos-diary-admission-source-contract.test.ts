import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

test("PAP-1400 explicit Skip opening is Diary-only entry, not a local photo or Core ACL waiver",()=>{
 const ui=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/DiaryCapturePanel.tsx"),"utf8");
 const presentation=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/ClassroomV4Presentation.tsx"),"utf8");
 const core=readFileSync(resolve(process.cwd(),"lib/tos-classroom-v18b-api.ts"),"utf8");
 const workflow=readFileSync(resolve(process.cwd(),".github/workflows/candidate-staging-deploy.yml"),"utf8");
 assert.match(core,/export const V18B_WRITE_ADMITTED=false;/,"default/Production singleton stays OFF");
 assert.match(ui,/isConfirmedSkipDiaryEntry\(model,classroom,confirmedSkipClassId\)/);
 assert.match(ui,/writeAdmitted=stagingHostAdmitted&&skipEntryConfirmed/);
 assert.match(ui,/isDiaryStagingWriterHost\(/);
 assert.match(ui,/NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE==="true"/);
 assert.match(ui,/createV18bApiTransport\(stagingHostAdmitted\)/);
 assert.match(presentation,/setConfirmedSkipClassId\(opening\)/);
 assert.match(presentation,/setConfirmedSkipClassId\(""\)/);
 assert.match(presentation,/confirmedSkipClassId=\{skipConfirmed\?current.id:""\}/);
 assert.doesNotMatch(ui,/openingFromCore/);
 assert.match(workflow,/NEXT_PUBLIC_PINO_DIARY_STAGING_WRITE: 'true'/);
 assert.match(workflow,/Verify BO contract, typecheck, build and dry-run/);
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
