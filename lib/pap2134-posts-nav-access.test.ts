import {test} from "node:test";
import assert from "node:assert/strict";
import {canOpenPosts} from "../app/bo/piner-posts/posts-nav-access";
const A="01900000-0000-7000-8000-000000000001",U="01900000-0000-7000-8000-000000000002",host="https://bo.staging.pinohouse.art";
const context={data:{userId:U,surface:"BO",entitled:true,permissionKeys:["piner.post.view"]}};
test("Posts navigation is authorized selected Center read only, same actor, empty allowed",async()=>{
 let calls=0;assert.equal(await canOpenPosts(A,new AbortController().signal,async(input,init)=>{
  calls++;const u=new URL(String(input),host);assert.equal(u.searchParams.get("centerId"),A);assert.equal(init?.method,"GET");assert.equal(init?.credentials,"same-origin");
  if(calls===1){assert.equal(u.pathname,"/api/bo/context");return Response.json(context);}
  assert.equal(u.pathname,"/api/bo/learning/piner-posts");assert.equal(u.searchParams.get("limit"),"1");assert.equal(new Headers(init?.headers).get("x-pino-expected-actor"),U);
  return Response.json({data:{posts:[],nextBeforeId:null}});
 }),true);assert.equal(calls,2);
});
test("Posts navigation denies wrong Center, malformed response, rejected and aborted requests",async()=>{
 const sig=new AbortController();
 for(const status of [401,403,404,500])assert.equal(await canOpenPosts(A,sig.signal,async()=>new Response(null,{status})),false);
 for(const data of [{...context.data,permissionKeys:[]},{...context.data,userId:"bad"},{...context.data,surface:"HO"},{...context.data,entitled:false}]){
  let calls=0;assert.equal(await canOpenPosts(A,sig.signal,async()=>{calls++;return Response.json({data});}),false);assert.equal(calls,1);
 }
 for(const result of [()=>new Response(null,{status:403}),()=>Response.json({data:{posts:[{centerId:"foreign"}],nextBeforeId:null}})]){
  let calls=0;assert.equal(await canOpenPosts(A,sig.signal,async()=>++calls===1?Response.json(context):result()),false);assert.equal(calls,2);
 }
 const stop=new AbortController();stop.abort();assert.equal(await canOpenPosts(A,stop.signal,async()=>{throw Error("must not fetch");}),false);
 assert.equal(await canOpenPosts("invalid",sig.signal,async()=>{throw Error("must not fetch");}),false);
});
