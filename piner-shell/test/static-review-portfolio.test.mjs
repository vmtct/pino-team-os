import assert from "node:assert/strict";
import test from "node:test";
import {mockProjection} from "./portfolio-fixture.mjs";
import {readStaticReviewPortfolio} from "../src/static-review-portfolio.mjs";
import {approvedSourceRevision,artifacts,registrations} from "../src/static-review-artifacts.mjs";
import {createHash} from "node:crypto";
const host="https://app.staging.pinohouse.art";
const chrome={runtime:true,selectedId:"synthetic-authorized-profile",students:[{id:"synthetic-authorized-profile",label:"Test"}]};
const env={APP_ENV:"staging",PINER_SYNTHETIC_REVIEW_ENABLED:"true",PINER_SYNTHETIC_REVIEW:{verify:async r=>({allowed:true,program:new URL(r.url).pathname.includes("mytime")?"mytime":"house"})}};
test("PAP-2377 four immutable static payloads match approved fixture bytes",()=>{
 for(const [path,bytes] of Object.entries(artifacts)){
  const data=JSON.parse(bytes);
  assert.equal(data.route,path); assert.equal(data.sourceRevision,approvedSourceRevision);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),registrations[path].sha256);
  assert.deepEqual(data.posts,mockProjection(data.space).posts);
  assert.equal("profileKey" in data,false);
 }
});
test("PAP-2377 only exact staging static admission, no synthetic profile substitution",async()=>{
 for(const path of Object.keys(artifacts)){
  const model=await readStaticReviewPortfolio(new Request(host+path),env,chrome);
  assert.equal(model?.posts.length,1);
  assert.equal(model.posts[0].synthetic,true);
 }
 const req=new Request(host+"/piner/house");
 assert.equal(await readStaticReviewPortfolio(req,{},chrome),null);
 assert.equal(await readStaticReviewPortfolio(req,env,null),null);
 assert.equal(await readStaticReviewPortfolio(req,env,{...chrome,selectedId:null}),null);
 assert.equal(await readStaticReviewPortfolio(req,env,{...chrome,selectedId:"unlinked"}),null);
 assert.equal(await readStaticReviewPortfolio(req,{...env,PINER_SYNTHETIC_REVIEW:{verify:async()=>({allowed:false})}},chrome),null);
 for(const path of ["/piner/house/reels","/piner/house?post=bad&photo=1","/piner/house?post=PORTFOLIO-MOCK-001&photo=3","/piner/house?x=1"]){
  assert.equal(await readStaticReviewPortfolio(new Request(host+path),env,chrome),null);
 }
 assert.equal(await readStaticReviewPortfolio(new Request("https://app.pinohouse.art/piner/house"),env,chrome),null);
 assert.equal(await readStaticReviewPortfolio(new Request(host+"/piner/house",{method:"POST"}),env,chrome),null);
 assert.equal((await readStaticReviewPortfolio(new Request(host+"/piner/house?post=PORTFOLIO-MOCK-001&photo=2"),env,chrome))?.posts.length,1);
});

import staging from "../src/staging-worker.mjs";
import {handleRequest} from "../src/worker.mjs";
test("PAP-2377 static content only on authenticated staging routes; default and public unchanged",async()=>{
 let proofs=0;
 const memberService={fetch:async req=>{
  assert.equal(req.headers.get("cookie"),"__Host-PINO_AFTERSCHOOL=isolated-test");
  return Response.json({data:req.url.endsWith("/session")?{authenticated:true,expiresAt:"2099-01-01T00:00:00.000Z"}:[{id:"fixture-only",displayName:"Synthetic linked learner"}]});
 }};
 const on={...env,AFTERSCHOOL_PIN_WORKER:memberService,PINER_SYNTHETIC_REVIEW:{verify:async req=>{proofs++;return env.PINER_SYNTHETIC_REVIEW.verify(req);}}};
 const req=(path,cookie=true,method="GET")=>new Request(host+path,{method,headers:cookie?{cookie:"__Host-PINO_AFTERSCHOOL=isolated-test"}:{}});
 const response=await staging.fetch(req("/piner/house"),on);
 assert.equal(response.status,200); assert.equal(response.headers.get("vary"),"Cookie");
 assert.match(response.headers.get("cache-control"),/no-store/);
 const html=await response.text(); assert.match(html,/data-feed-post="PORTFOLIO-MOCK-001"/);
 assert.match(html,/Synthetic linked learner/); assert.doesNotMatch(html,/MOCK-PROFILE-|isolated-test/);
 assert.equal((html.match(/data-line-icon=/g)||[]).length,4);
 for(const path of ["/piner/house/grid","/piner/mytime","/piner/mytime/grid"]){
  const r=await staging.fetch(req(path),on); assert.equal(r.status,200); assert.match(await r.text(),/PORTFOLIO-MOCK-001/);
 }
 assert.equal(proofs,4);
 for(const path of ["/","/piner/house/reels","/piner/mytime/community"]){
  const r=await staging.fetch(req(path),on);assert.doesNotMatch(await r.text(),/PORTFOLIO-MOCK-001/);
 }
 const off=await staging.fetch(req("/piner/house"),{...on,PINER_SYNTHETIC_REVIEW_ENABLED:"false"});
 assert.doesNotMatch(await off.text(),/PORTFOLIO-MOCK-001/);
 assert.equal(proofs,4);
 const anon=await staging.fetch(req("/piner/house",false),on); assert.equal(anon.status,302); assert.equal(proofs,4);
 const invalid=await staging.fetch(req("/piner/house?photo=1"),on);assert.doesNotMatch(await invalid.text(),/PORTFOLIO-MOCK-001/);
 const denied=await staging.fetch(req("/piner/mytime"),{...on,PINER_SYNTHETIC_REVIEW:{verify:async()=>({allowed:false})}});assert.doesNotMatch(await denied.text(),/PORTFOLIO-MOCK-001/);
 const head=await staging.fetch(req("/piner/mytime",true,"HEAD"),on);assert.equal(await head.text(),"");
 const prod=await handleRequest(new Request("https://app.pinohouse.art/piner/house"),on);assert.doesNotMatch(await prod.text(),/PORTFOLIO-MOCK-001/);
});
