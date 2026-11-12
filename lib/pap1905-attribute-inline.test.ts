/** PAP-1905 / PAP-1665 PLT-ATTR: strict FSG5-B HO Definition metadata ingress. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideHostBoundary} from "./host-boundary";
import {validHoDefinitionMetadataPatch,hoAttributeDefinitions} from "./ho-attribute-definitions-facade";
const id="019d1000-0001-7000-8000-000000000001";
const route="/api/ho/custom-attributes/definitions/"+id;
test("PAP-1905 exact HO detail metadata PATCH only",()=>{
 assert.equal(decideHostBoundary("ho.staging.pinohouse.art",route,"PATCH").action,"next");
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"]){
  assert.equal(decideHostBoundary(host,route,"PATCH").action,"not_found");
 }
 for(const path of [route+"/history",route+"/extra",route+"-bad"])
  assert.equal(decideHostBoundary("ho.staging.pinohouse.art",path,"PATCH").action,"not_found");
});
test("PAP-1905 native DSA detail supports one typed editor without legacy layout",()=>{
 const page=readFileSync("app/ho/system/custom-attributes/HoAttributeFullDetail.tsx","utf8");
 assert.match(page,/<DetailFrame/);
 assert.match(page,/<PropertySections/);
 assert.match(page,/BoTypedEditor/);
 assert.equal((page.match(/<BoTypedEditor/g)||[]).length,1);
 assert.ok(page.includes('detail?.status==="DRAFT"'));
 assert.match(page,/needsOptions/);assert.match(page,/optionsField/);
 assert.match(page,/selectedCenterId,expectedRevision:detail.revision/);
 assert.doesNotMatch(page,/legacyContent=/);
});
const center="019d1000-0001-7000-8000-000000000002";
const payload={selectedCenterId:center,expectedRevision:1,displayName:"Nguồn giới thiệu"};
test("PAP-1905 closed-world metadata CAS, no lifecycle or mass assignment",()=>{
 for(const patch of [
  payload,{selectedCenterId:center,expectedRevision:1,required:true},
  {selectedCenterId:center,expectedRevision:1,visibility:["BO","HO"]},
  {selectedCenterId:center,expectedRevision:1,options:["School","PINO"]}
 ])assert.equal(validHoDefinitionMetadataPatch(patch),true);
 for(const patch of [
  {...payload,status:"ACTIVE"},{...payload,attributeKey:"bad"},
  {...payload,required:true},{...payload,expectedRevision:0},
  {...payload,selectedCenterId:"bogus"}, {...payload,displayName:""},
  {selectedCenterId:center,expectedRevision:1,visibility:["BO","BO"]},
  {selectedCenterId:center,expectedRevision:1,options:[]},
  {selectedCenterId:center,expectedRevision:1,required:"true"}
 ])assert.equal(validHoDefinitionMetadataPatch(patch),false);
});
test("PAP-1905 invalid metadata rejected before attempting identity/Core, no prod admission",async()=>{
 const root="https://ho.staging.pinohouse.art"+route;
 const env={APP_ENV:"staging"} as Parameters<typeof hoAttributeDefinitions>[1];
 const make=(body:unknown)=>new Request(root,{method:"PATCH",headers:{
  host:"ho.staging.pinohouse.art",origin:"https://ho.staging.pinohouse.art",
  "content-type":"application/json"
 },body:JSON.stringify(body)});
 assert.equal((await hoAttributeDefinitions(make({...payload,status:"ACTIVE"}),env)).status,400);
 assert.equal((await hoAttributeDefinitions(make({...payload,required:true}),env)).status,400);
 assert.equal((await hoAttributeDefinitions(make(payload),{APP_ENV:"production"} as typeof env)).status,404);
});
test("PAP-1905 synthetic Founder BFF forwards metadata PATCH exactly; Core 409 remains 409",async()=>{
 const forwarded:Array<{method:string;path:string;body:unknown}>=[];
 const env=(result=200,founder=true)=>({
  APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",
  PINO_BO_CORE:{async executeWithStaffPassword(req:{path:string}){
   return req.path==="context"?{status:200,requestId:"mock-bo",body:{data:{
    userId:founder?"founder":"manager",email:"fixture@invalid.local",
    surface:"BO",entitled:true,permissionKeys:["team.bo.access"]
   }}}:{status:founder?200:403,requestId:"mock-admission",body:{data:{admitted:founder}}};
  }},
  PINO_CORE:{async executeWithStaffPassword(req:{method:string;path:string;body?:unknown}){
   forwarded.push({method:req.method,path:req.path,body:req.body});
   return {status:result,requestId:"synthetic-1905",
    body:result===200?{data:{id,revision:2,displayName:"Nguồn giới thiệu"}}:
     {error:{code:"ATTRIBUTE_REVISION_CONFLICT"}}};
  }}
 }) as Parameters<typeof hoAttributeDefinitions>[1];
 const make=()=>new Request("https://ho.staging.pinohouse.art"+route,{
  method:"PATCH",headers:{host:"ho.staging.pinohouse.art",
   origin:"https://ho.staging.pinohouse.art",
   cookie:"pino_staff_password_session=synthetic",
   "content-type":"application/json"},
  body:JSON.stringify(payload)
 });
 const first=await hoAttributeDefinitions(make(),env());
 assert.equal(first.status,200);
 assert.equal(first.headers.get("cache-control"),"no-store");
 assert.deepEqual(forwarded,[{method:"PATCH",path:"custom-attributes/definitions/"+id,body:payload}]);
 assert.equal((await hoAttributeDefinitions(make(),env(409))).status,409);
 assert.equal((await hoAttributeDefinitions(make(),env(200,false))).status,403);
 assert.equal(forwarded.length,2);
});