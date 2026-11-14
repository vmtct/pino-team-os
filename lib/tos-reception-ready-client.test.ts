import {test} from "node:test";
import assert from "node:assert/strict";
import {readReceptionReady,confirmReceptionReady,parseReceptionPhoto} from "./tos-reception-ready-client";
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
