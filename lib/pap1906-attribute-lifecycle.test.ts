/** PAP-1906 / PLT-ATTR — candidate UI and Founder facade, host admission separately serialized. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nextLifecycle,lifecyclePayload} from "./ho-attribute-lifecycle";
import {validHoLifecycleCommand,hoAttributeDefinitions} from "./ho-attribute-definitions-facade";
import type {AttributeDefinition} from "./ho-attribute-model";
const id="019d1000-0001-7000-8000-000000000001",center="019d1000-0001-7000-8000-000000000002";
const route="/api/ho/custom-attributes/definitions/"+id+"/lifecycle";
const host="ho.staging.pinohouse.art";
const def=(scope:AttributeDefinition["scope"],status:AttributeDefinition["status"])=>({scope,status,centerId:scope==="CENTER"?center:null,revision:1} as AttributeDefinition);
test("PAP-1906 only one forward target; GLOBAL activation explicitly selected and saved",()=>{
 assert.deepEqual(["DRAFT","PILOT","ACTIVE","DEPRECATED","ARCHIVED"].map(s=>nextLifecycle("CENTER",s as AttributeDefinition["status"])),["PILOT","ACTIVE","DEPRECATED","ARCHIVED",null]);
 assert.equal(nextLifecycle("GLOBAL","PILOT"),null);
 assert.equal(lifecyclePayload(def("GLOBAL","DRAFT"),center,""),null);
 assert.deepEqual(lifecyclePayload(def("GLOBAL","DRAFT"),center,"ACTIVE"),{selectedCenterId:center,expectedRevision:1,targetStatus:"ACTIVE",confirmGlobalActivation:true});
 assert.equal(lifecyclePayload(def("CENTER","DRAFT"),center,"ACTIVE"),null);
 assert.equal(lifecyclePayload(def("CENTER","DRAFT"),id,"PILOT"),null);
 assert.equal(lifecyclePayload(def("GLOBAL","DRAFT"),"","ACTIVE"),null);
});
const payload={selectedCenterId:center,expectedRevision:1,targetStatus:"ACTIVE",confirmGlobalActivation:true};
test("PAP-1906 closed-world command rejects extra metadata, zero revision, false confirmation",()=>{
 assert.equal(validHoLifecycleCommand(payload),true);
 for(const body of [{...payload,required:true},{...payload,expectedRevision:0},{...payload,confirmGlobalActivation:false},{...payload,targetStatus:"DRAFT"},{...payload,selectedCenterId:"bad"}])assert.equal(validHoLifecycleCommand(body),false);
});
test("PAP-1906 only actual Founder facade POST, exact forwarding, no-store and Core conflict",async()=>{
 const calls:unknown[]=[];
 const env=(status=200,founder=true)=>({
 APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",
 PINO_BO_CORE:{async executeWithStaffPassword(req:{path:string}){return req.path==="context"?{status:200,body:{data:{userId:founder?"founder":"manager",email:"fixture@invalid.local",surface:"BO",entitled:true,permissionKeys:["team.bo.access"]}}}:{status:founder?200:403,body:{data:{admitted:founder}}};}},
 PINO_CORE:{async executeWithStaffPassword(req:{method:string;path:string;body?:unknown}){calls.push({method:req.method,path:req.path,body:req.body});return {status,body:status===200?{data:{id,revision:2,status:"ACTIVE"}}:{error:{code:"ATTRIBUTE_LIFECYCLE_CONFLICT"}}};}}
 }) as Parameters<typeof hoAttributeDefinitions>[1];
 const make=(body:unknown=payload,method="POST",origin="https://"+host,path=route)=>new Request("https://"+host+path,{method,headers:{host,origin,cookie:"pino_staff_password_session=synthetic","content-type":"application/json"},...(method==="GET"?{}:{body:JSON.stringify(body)})});
 const ok=await hoAttributeDefinitions(make(),env());
 assert.equal(ok.status,200);assert.equal(ok.headers.get("cache-control"),"no-store");
 assert.deepEqual(calls,[{method:"POST",path:"custom-attributes/definitions/"+id+"/lifecycle",body:payload}]);
 assert.equal((await hoAttributeDefinitions(make(),env(409))).status,409);
 assert.equal((await hoAttributeDefinitions(make(),env(200,false))).status,403);
 assert.equal((await hoAttributeDefinitions(make({...payload,required:true}),env())).status,400);
 assert.equal((await hoAttributeDefinitions(make(payload,"GET"),env())).status,405);
 assert.equal((await hoAttributeDefinitions(make(payload,"POST","https://other.invalid"),env())).status,403);
 assert.equal((await hoAttributeDefinitions(make(payload,"POST","https://"+host,route+"?x=1"),env())).status,400);
 assert.equal((await hoAttributeDefinitions(make(),{APP_ENV:"production"} as ReturnType<typeof env>)).status,404);
 assert.equal(calls.length,2);
});
test("PAP-1906 existing single native editor and explicit Core readback retained",()=>{
 const src=readFileSync("app/ho/system/custom-attributes/HoAttributeFullDetail.tsx","utf8");
 assert.equal((src.match(/<BoTypedEditor/g)||[]).length,1);
 assert.match(src,/lifecyclePayload\(detail,selectedCenterId,raw\)/);
 assert.match(src,/Kích hoạt toàn hệ thống/);
 assert.match(src,/changed.data.status!==body.targetStatus/);
 assert.match(src,/read.data.status!==body.targetStatus/);
 assert.match(src,/editor.field.key==="lifecycleState"\?"":/);
});
