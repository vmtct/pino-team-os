import {test} from "node:test";
import assert from "node:assert/strict";
import {readReceptionReady,confirmReceptionReady,parseReceptionPhoto,appendReceptionEvidence,receptionEvidencePhoto,newReceptionCorrectionKey,parseReceptionHistory} from "./tos-reception-ready-client";
const scope={centerId:"center",workDate:"2026-11-14",shiftTemplateId:"shift"};
const receipt={receipt_id:"receipt",center_id:scope.centerId,work_date:scope.workDate,shift_template_id:scope.shiftTemplateId,opened_at:"2026-11-14T01:00:00.000Z"};
const photo="data:image/jpeg;base64,/9j/4A==";
void test("PAP-763 READY capability and confirmed receipt must come from Core",async t=>{
  const calls:Array<{url:string;init?:RequestInit}>=[];
  const responses=[{data:{state:"NOT_READY",receipt:null,canConfirm:true}},{data:{outcome:"CREATED",receipt}},
    {data:{state:"READY",receipt:{...receipt,center_id:"other"}}}];
  t.mock.method(globalThis,"fetch",(url:string,init?:RequestInit)=>{
    calls.push({url,...(init?{init}:{})});
    return Promise.resolve(new Response(JSON.stringify(responses.shift()),{status:200}));
  });
  assert.deepEqual(await readReceptionReady(scope),{state:"NOT_READY",receipt:null,canConfirm:true});
  assert.deepEqual(await confirmReceptionReady(scope,photo),receipt);
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)),{...scope,photo:{mimeType:"image/jpeg",base64:"/9j/4A=="}});
  assert.ok(calls[0]?.url.includes("shiftTemplateId=shift"));
  await assert.rejects(readReceptionReady(scope),/không đúng phạm vi/);
});
void test("PAP-763 missing confirmation entitlement, denied or malformed response fail closed",async t=>{
  const responses=[new Response(JSON.stringify({data:{state:"NOT_READY",receipt:null}})),new Response("{}",{status:403}),
    new Response(JSON.stringify({data:{outcome:"CREATED",receipt:null}}))];
  t.mock.method(globalThis,"fetch",()=>Promise.resolve(responses.shift()!));
  assert.equal((await readReceptionReady(scope)).canConfirm,false);
  await assert.rejects(confirmReceptionReady(scope,photo),/chưa được phép/);
  await assert.rejects(confirmReceptionReady(scope,photo),/không đúng phạm vi/);
  assert.throws(()=>parseReceptionPhoto("data:text/html;base64,AAAA"),/không hợp lệ/);
});

void test("PAP-763 reception correction preserves the same READY and appends one multi-photo round",async t=>{
 const id=(n:number)=>"00000000-0000-7000-8000-"+String(n).padStart(12,"0");
 const r={...receipt,receipt_id:id(1)};
 const first={eventId:id(2),roundId:id(2),version:1,kind:"SUBMISSION",actorLegalFullName:null,occurredAt:r.opened_at,privateAssetIds:[id(3)],note:"",verdict:null,reason:null};
 const reject={eventId:id(4),roundId:id(2),version:2,kind:"REVIEW",actorLegalFullName:null,occurredAt:r.opened_at,privateAssetIds:[],note:"",verdict:"REJECTED",reason:"Ảnh chưa đủ sáng"};
 const next={...first,eventId:id(5),roundId:id(5),version:3,privateAssetIds:[id(6),id(7)],note:"Góc quầy"};
 const opened={...scope,state:"READY",receipt:r,canAppend:true,history:[first,reject]};
 const replies=[opened,{...opened,history:[first,reject,next]},{mimeType:"image/jpeg",base64:"/9j/4A=="}];
 const calls:Array<{url:string;init?:RequestInit}>=[];
 t.mock.method(globalThis,"fetch",(url:string,init?:RequestInit)=>{calls.push({url,...(init?{init}:{})});return Promise.resolve(new Response(JSON.stringify({data:replies.shift()})));});
 const state=await readReceptionReady(scope);
 assert.equal(state.state,"READY");if(state.state!=="READY")throw new Error("missing READY");
 const key=newReceptionCorrectionKey();
 const result=await appendReceptionEvidence(scope,state,[photo,photo],"Góc quầy",key);
 assert.equal(result.receipt.receipt_id,r.receipt_id);assert.equal(result.history?.length,3);assert.equal(result.history?.at(-1)?.privateAssetIds.length,2);
 assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)),{...scope,openingReceiptId:r.receipt_id,expectedVersion:2,requestKey:key,photos:[parseReceptionPhoto(photo),parseReceptionPhoto(photo)],note:"Góc quầy"});
 assert.equal(await receptionEvidencePhoto(scope,r.receipt_id,id(7)),photo);
 assert.throws(()=>parseReceptionHistory([first,{...next,version:2,privateAssetIds:[id(3)]}]),/không hợp lệ/);
});
