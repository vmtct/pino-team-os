import {test} from "node:test";
import assert from "node:assert/strict";
import {parseEvidenceRow,parseEvidenceDetail,openingEvidenceApi,newReviewRequestKey,type OpeningEvidenceRow} from "./bo-opening-evidence-api";
const id=(n:number)=>"00000000-0000-7000-8000-"+String(n).padStart(12,"0");
const at="2026-11-14T01:00:00.000Z";
const row:OpeningEvidenceRow={subjectType:"CLASS",openingReceiptId:id(1),centerId:id(2),workDate:"2026-11-14",subjectLabel:"Art",
  openedAt:at,submittedByLegalFullName:null,status:"PENDING",latestRoundId:id(3),version:1,lastModifiedAt:at,lastModifiedByLegalFullName:null,canReview:true};
const detail={row,history:[{eventId:id(3),version:1,kind:"SUBMISSION",roundId:id(3),actorLegalFullName:null,occurredAt:at,privateAssetId:id(4),verdict:null,reason:null}]};
void test("PAP-764 BO read model validates exact Center, typed receipt and latest immutable history",()=>{
  assert.deepEqual(parseEvidenceRow(row,row.centerId),row);
  assert.deepEqual(parseEvidenceDetail(detail,row.centerId,row.subjectType,row.openingReceiptId),detail);
  assert.throws(()=>parseEvidenceRow(row,id(9)),/không hợp lệ/);
  assert.throws(()=>parseEvidenceRow({...row,status:"APPROVED"},row.centerId),/không hợp lệ/);
  assert.throws(()=>parseEvidenceDetail(detail,row.centerId,"RECEPTION",row.openingReceiptId),/phạm vi/);
  assert.throws(()=>parseEvidenceDetail({...detail,history:[]},row.centerId,row.subjectType,row.openingReceiptId),/phạm vi/);
  assert.throws(()=>parseEvidenceDetail({...detail,row:{...row,version:2},history:[...detail.history,{...detail.history[0],version:2}]},row.centerId,row.subjectType,row.openingReceiptId),/khớp|hợp lệ/);
});
void test("PAP-764 list and review use scoped Core payload, never optimistic or fabricated success",async t=>{
  const responses=[new Response(JSON.stringify({data:{rows:[row],total:1}})),
    new Response(JSON.stringify({data:{outcome:"CREATED",event:{version:2,round_id:row.latestRoundId,verdict:"APPROVED"}}})),
    new Response("{}",{status:409})];
  const calls:Array<{url:string;init?:RequestInit}>=[];
  t.mock.method(globalThis,"fetch",(url:string,init?:RequestInit)=>{
    calls.push({url,...(init?{init}:{})});return Promise.resolve(responses.shift()!);
  });
  assert.equal((await openingEvidenceApi.list({centerId:row.centerId,status:"PENDING",offset:0,limit:25})).rows.length,1);
  const key=newReviewRequestKey();
  assert.match(key,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await openingEvidenceApi.review(row,"APPROVED","",key);
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)),{centerId:row.centerId,expectedVersion:1,roundId:row.latestRoundId,verdict:"APPROVED",reason:"",requestKey:key});
  await assert.rejects(openingEvidenceApi.review(row,"REJECTED","bad",key),/đủ điều kiện/);
  await assert.rejects(openingEvidenceApi.review(row,"REJECTED","Ảnh không đủ sáng",key),/đã thay đổi/);
  assert.equal(calls.length,3);
});
