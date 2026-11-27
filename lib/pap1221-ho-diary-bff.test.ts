import test from "node:test";
import assert from "node:assert/strict";
import {handleHoDiaryRead,type DiaryHoEnv} from "@/app/api/ho/learning/path-diaries/[[...path]]/route";
import {surfaceSession} from "@/lib/workspace-adapters/session";

const host="https://ho.staging.pinohouse.art";
const id="01912345-6789-7abc-8def-0123456789ac";
const env={APP_ENV:"production"} as DiaryHoEnv;
test("PAP-1221 BFF never dispatches an unadmitted verb/path/query to Core",async()=>{
 for(const [method,segments,query,status] of [
  ["POST",[],"",404],["DELETE",[id],"",404],
  ["GET",["random"],"",404],["GET",[id,"evidence"],"",404],
  ["GET",[],"?unexpected=x",400],["GET",[],"?centerId=bad",400],
  ["GET",[],"?limit=101",400],["GET",[],"?localDate=2026-02-30",400],
  ["GET",[],"?offset=1&offset=2",400],
 ] as const){
  const response=await handleHoDiaryRead(new Request(host+"/api/ho/learning/path-diaries"+query,{method}),env,segments);
  assert.equal(response.status,status,method+" "+JSON.stringify(segments)+" "+query);
 }
});
test("PAP-1221 BFF denies outside HO staging before asking for Core credential",async()=>{
 const r=await handleHoDiaryRead(new Request(host+"/api/ho/learning/path-diaries",
  {headers:{host:"ho.staging.pinohouse.art"}}),env,[]);
 assert.equal(r.status,404,"APP_ENV production is forbidden");
});
test("PAP-1221 HO list forwards bounded filters in the Core Founder request body",async()=>{
 const centerId="01912345-6789-7abc-8def-0123456789ad";
 const localDate="2026-11-22";
 const page={data:{centerId,localDate,diaries:[],hasMore:false,limit:100,offset:0}};
 const forwarded:Array<{method:string;path:string;body?:unknown;token:string}>=[];
 const authorizedEnv={
  APP_ENV:"staging",
  HO_PILOT_FOUNDER_USER_IDS:"founder",
  PINO_BO_CORE:{async executeWithStaffPassword(request:{path:string},token:string){
   assert.equal(token,"valid");
   if(request.path==="context")return{status:200,requestId:"context",body:{data:{
    userId:"founder",email:"founder@example.invalid",surface:"BO",entitled:true,
   }}};
   if(request.path==="ho/admission")return{status:200,requestId:"admission",body:{data:{admitted:true}}};
   throw new Error("Unexpected BO Core request: "+request.path);
  }},
  PINO_CORE:{async executeWithStaffPassword(request:{method:string;path:string;body?:unknown},token:string){
   forwarded.push({...request,token});
   return{status:200,requestId:"diary-read",body:page};
  }},
 } as DiaryHoEnv;
 const request=new Request(host+"/api/ho/learning/path-diaries?centerId="+centerId+
  "&localDate="+localDate+"&limit=100&offset=0",{method:"GET",headers:{
   host:"ho.staging.pinohouse.art",cookie:"pino_staff_password_session=valid",
  }});
 const response=await handleHoDiaryRead(request,authorizedEnv,[]);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),page);
 assert.equal(response.headers.get("x-request-id"),"diary-read");
 assert.deepEqual(forwarded,[{
  method:"GET",path:"/learning/path-diaries",
  body:{centerId,localDate,limit:100,offset:0},token:"valid",
 }]);
});
test("PAP-1221 shared HO TDD session admits only bounded GET GLOBAL Diary endpoint",async()=>{
 const calls:string[]=[];
 const transport:typeof fetch=async input=>{calls.push(String(input));return Response.json({data:[]})};
 const s=surfaceSession("HO",host,transport);
 try{
  const good=await s.transport("/api/ho/learning/path-diaries?localDate=2026-10-31",{method:"GET"});
  assert.equal(good.status,200);
  assert.equal(calls.length,1);
  await assert.rejects(s.transport("/api/ho/learning/path-diaries",{method:"POST"}),/Không thể truy cập/);
  await assert.rejects(s.transport("/api/ho/learning/path-diaries/"+id+"/evidence",{method:"GET"}),/Không thể truy cập/);
  await assert.rejects(s.transport("https://bo.staging.pinohouse.art/api/ho/learning/path-diaries",{method:"GET"}),/Không thể truy cập/);
  assert.equal(calls.length,1,"blocked calls never hit fetch");
 }finally{s.dispose()}
});
