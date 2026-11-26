import {test} from "node:test";
import assert from "node:assert/strict";
import {createLeadManualIntakeApi,parseManualIntake,parseManualIntakeReceipt,parseManualIntakeRecovery,parseManualCenters} from "./bo-lead-manual-intake-api";
import {openNativeLeadAdapter} from "../app/bo/sales/leads/native-lead-adapter";
const a="01a03c6e-cc58-7d81-ac8e-123456789abc",b="01a03c6e-cc58-7d81-ac8e-123456789abd",c="01a03c6e-cc58-7d81-ac8e-123456789abe",key="synthetic-manual-key-123";
const input={centerId:a,phone:"+84 900032402",sourceBrand:"PINO_HOUSE",intentKind:"GENERAL_INQUIRY",childAge:null} as const;
const receipt={centerId:a,intentId:b,leadId:null,status:"SUBMITTED"} as const;
test("PAP-2288 manual intake projects only authorized center and nullable household identity",()=>{
 assert.deepEqual(parseManualIntake(input),{...input,phone:"0900032402"});
 for(const x of [{...input,leadId:b},{...input,childAge:18},{...input,phone:"bad"},{...input,centerId:"bad"}])assert.equal(parseManualIntake(x),null);
 assert.deepEqual(parseManualIntakeReceipt(receipt,a),receipt);
 assert.equal(parseManualIntakeReceipt({...receipt,phone:"private"},a),null);
 assert.equal(parseManualIntakeReceipt(receipt,c),null);
 assert.equal(parseManualIntakeRecovery({centerId:a,key,phone:"private"}),null);
 const center={id:a,centerKey:"qa",displayName:"Synthetic Center",timeZone:"Asia/Ho_Chi_Minh",status:"active"};
 assert.deepEqual(parseManualCenters([center],true),[{id:a,displayName:"Synthetic Center"}]);
 assert.equal(parseManualCenters([center,center],true),null);
 assert.equal(parseManualCenters([{...center,status:"inactive"}],true),null);
});
test("PAP-2288 manual intake same actor lifetime, exact paths and key-free recovery",async()=>{
 const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const adapter=openNativeLeadAdapter(a,"https://bo.staging.pinohouse.art",{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},async(url,init)=>{
  calls.push({url:String(url),init});return Response.json({data:String(url).endsWith("manual-centers")?[{id:a,displayName:"Synthetic Center"}]:receipt},{status:String(url).endsWith("manual-intake")?201:200});
 });
 assert.deepEqual(await adapter.manual.centers(),[{id:a,displayName:"Synthetic Center"}]);
 assert.deepEqual(await adapter.manual.submit(input,key),receipt);
 assert.deepEqual(await adapter.manual.recover({centerId:a,key}),receipt);
 assert.equal(calls[0]?.init?.method,"GET");
 assert.equal(new Headers(calls[1]?.init?.headers).get("idempotency-key"),key);
 assert.equal(new Headers(calls[2]?.init?.headers).get("idempotency-key"),null);
 assert.equal(new Headers(calls[2]?.init?.headers).get("x-pino-expected-actor"),a);
 adapter.dispose();await assert.rejects(adapter.manual.centers());assert.equal(calls.length,3);
 const bad=createLeadManualIntakeApi(async()=>Response.json({data:{...receipt,centerId:c}},{status:201}));
 await assert.rejects(bad.submit(input,key));
});
test("PAP-2288 only exact initial manual 422 proof is definitive",async()=>{
 const {ManualIntakeDefinitiveRejection}=await import("./bo-lead-manual-intake-api");
 const proof={centerId:a,key,outcome:"NOT_COMMITTED"};
 const exactApi=createLeadManualIntakeApi(async()=>Response.json({data:proof},{status:422}));
 await assert.rejects(exactApi.submit(input,key),e=>e instanceof ManualIntakeDefinitiveRejection&&e.centerId===a&&e.key===key);
 await assert.rejects(exactApi.recover({centerId:a,key}),e=>!(e instanceof ManualIntakeDefinitiveRejection));
 for(const data of [{...proof,key:"other-synthetic-key"},{...proof,centerId:b},{...proof,phone:"private"},{...proof,outcome:"UNKNOWN"}]){
  const api=createLeadManualIntakeApi(async()=>Response.json({data},{status:422}));
  await assert.rejects(api.submit(input,key),e=>!(e instanceof ManualIntakeDefinitiveRejection));
 }
 const generic=createLeadManualIntakeApi(async()=>Response.json({error:{code:"INVALID"}},{status:400}));
 await assert.rejects(generic.submit(input,key),e=>!(e instanceof ManualIntakeDefinitiveRejection));
});
