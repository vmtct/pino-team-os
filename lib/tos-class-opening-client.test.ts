import {test} from "node:test";
import assert from "node:assert/strict";
import {parseClassOpening,readClassOpening,confirmClassOpening,appendClassOpening,classOpeningPhoto,newOpeningRequestKey} from "./tos-class-opening-client";
const id=(n:number)=>"00000000-0000-7000-8000-"+String(n).padStart(12,"0");
const scope={centerId:id(1),runningClassId:id(2),localDate:"2026-11-14"};
const at="2026-11-14T01:00:00.000Z";
const receipt={kind:"CLASS_FIRST_OPENED",source:"DELIVERY_COMMITTED_OPEN",receiptId:id(3),...scope,
  occurrenceKey:scope.runningClassId+":"+scope.localDate,openedAt:at};
const first={eventId:id(4),roundId:id(4),version:1,kind:"SUBMISSION",actorLegalFullName:null,occurredAt:at,
  privateAssetId:id(5),verdict:null,reason:null};
const review={eventId:id(6),roundId:id(4),version:2,kind:"REVIEW",actorLegalFullName:"Nguyễn Văn A",occurredAt:at,
  privateAssetId:null,verdict:"REJECTED",reason:"Ảnh chưa đủ sáng"};
const opened={...scope,state:"OPENED",receipt,canConfirm:false,canAppend:true,openedByLegalFullName:null,history:[first,review]};
const notOpened={...scope,state:"NOT_OPENED",receipt:null,history:[],canConfirm:true,canAppend:false};
const data="data:image/jpeg;base64,/9j/4A==";
void test("PAP-1991 server OPEN and immutable rejected history, no speculative names",()=>{
  assert.deepEqual(parseClassOpening(notOpened,scope),{opening:null,canConfirm:true});
  const snapshot=parseClassOpening(opened,scope);
  assert.equal(snapshot.opening?.receiptId,receipt.receiptId);
  assert.equal(snapshot.opening?.openedBy,"—");
  assert.equal(snapshot.opening?.rounds?.[0]?.status,"REJECTED");
  assert.throws(()=>parseClassOpening({...opened,receipt:{...receipt,centerId:id(9)}},scope),/không hợp lệ/);
  assert.throws(()=>parseClassOpening({...opened,history:[first,{...review,roundId:id(9)}]},scope),/không hợp lệ/);
  assert.throws(()=>parseClassOpening({...opened,history:[first,{...first,version:2}]},scope),/không hợp lệ/);
});
void test("PAP-1991 confirm, append CAS and private photo use exact scoped Core response",async t=>{
  const corrected={...opened,history:[first,review,{...first,eventId:id(7),roundId:id(7),privateAssetId:id(8),version:3}]};
  const responses=[notOpened,opened,corrected,{mimeType:"image/jpeg",base64:"/9j/4A=="}];
  const calls:Array<{url:string;init?:RequestInit}>=[];
  t.mock.method(globalThis,"fetch",(url:string,init?:RequestInit)=>{
    calls.push({url,...(init?{init}:{})});return Promise.resolve(new Response(JSON.stringify({data:responses.shift()}),{status:200}));
  });
  assert.equal((await readClassOpening(scope)).canConfirm,true);
  const openedRecord=(await confirmClassOpening(scope,data)).opening;
  assert.ok(openedRecord);
  const key=newOpeningRequestKey();
  const final=await appendClassOpening(scope,openedRecord,data,key);
  assert.equal(final.opening?.rounds?.at(-1)?.status,"PENDING");
  assert.equal(final.opening?.version,3);
  assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)),{...scope,openingReceiptId:receipt.receiptId,expectedVersion:2,requestKey:key,
    photo:{mimeType:"image/jpeg",base64:"/9j/4A=="}});
  assert.equal(await classOpeningPhoto(scope,receipt.receiptId,id(8)),data);
});
void test("PAP-1991 denial and mismatched write readback fail closed",async t=>{
  const replies=[new Response("{}",{status:403}),new Response(JSON.stringify({data:notOpened})),new Response(JSON.stringify({data:{...opened,centerId:id(9)}}))];
  t.mock.method(globalThis,"fetch",()=>Promise.resolve(replies.shift()!));
  await assert.rejects(readClassOpening(scope),/chưa có quyền/);
  await assert.rejects(confirmClassOpening(scope,data),/không hợp lệ/);
  await assert.rejects(confirmClassOpening(scope,data),/không hợp lệ/);
});

void test("PAP-1991 correction sends and reads all photos and note in one version",async t=>{
 const corrected={...opened,history:[first,review,{...first,eventId:id(7),roundId:id(7),privateAssetId:id(8),privateAssetIds:[id(8),id(9)],note:"Bổ sung góc bàn",version:3}]};
 const calls:RequestInit[]=[];
 t.mock.method(globalThis,"fetch",(_url:string,init:RequestInit)=>{calls.push(init);return Promise.resolve(new Response(JSON.stringify({data:corrected})));});
 const record=parseClassOpening(opened,scope).opening!;
 const result=await appendClassOpening(scope,record,[data,data],newOpeningRequestKey(),"Bổ sung góc bàn");
 const round=result.opening?.rounds?.at(-1);
 assert.equal(round?.photos.length,2);assert.equal(round?.note,"Bổ sung góc bàn");assert.equal(result.opening?.version,3);
 const body=JSON.parse(String(calls[0]?.body));
 assert.equal(body.photos.length,2);assert.equal(body.note,"Bổ sung góc bàn");assert.equal(body.expectedVersion,2);
 assert.throws(()=>parseClassOpening({...corrected,history:[first,review,{...corrected.history[2],privateAssetIds:[id(8),id(5)]}]},scope),/không hợp lệ/);
});
