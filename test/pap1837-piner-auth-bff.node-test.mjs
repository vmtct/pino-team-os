// PAP-1837 / PNR-IDENTITY — synthetic-only, no external OTP or real phone.
import test from "node:test";
import assert from "node:assert/strict";
import { handlePinerAuth, isPinerAuthPath, PinerOtpRateGuard } from "../lib/piner-auth-bff.mjs";
const HOST="https://piner-space-staging.test";
const PHONE="+84901234567"; // synthetic only
const UUID="0199f733-678a-7000-8000-000000000000";
const TOKEN="synthetic_core_bearer_token_long_enough";
const SERVICE_KEY="synthetic-pap1845-32-byte-service-secret-only-in-tests";
const DAY=86_400_000;
const reply=(data,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"Content-Type":"application/json"}});
function req(path,method="GET",body=null,options={}){
 const h=new Headers({
  "cf-connecting-ip":options.ip??"198.51.100.42","user-agent":"PAP1837-Synthetic",
  ...(method==="POST"&&options.origin!==false?{origin:options.crossSite?"https://untrusted.test":HOST,"sec-fetch-site":options.crossSite?"cross-site":"same-origin"}:{}),
  ...(body!==null?{"Content-Type":"application/json"}:{}),
  ...(options.cookie?{cookie:options.cookie}:{})
 });
 return new Request(HOST+path,{method,headers:h,...(body!==null?{body:JSON.stringify(body)}:{})});
}
const post=(path,body,opts)=>req("/api/piner/auth"+path,"POST",body,opts);
const get=(path,opts)=>req("/api/piner/auth"+path,"GET",null,opts);
function limiter(){
 const db=new Map();
 return {
  idFromName:id=>id,
  get(id){
   if(!db.has(id))db.set(id,new Map());
   const store=db.get(id);
   const obj=new PinerOtpRateGuard({storage:{transaction:fn=>fn({get:async key=>store.get(key),put:async(key,val)=>store.set(key,val)})}});
   return {fetch:(input,options)=>obj.fetch(input instanceof Request?input:new Request(input,options))};
  },
  get keys(){return [...db.keys()]}
 };
}
function fixture({enabled=true,seal=true,rate=true,upstream=true,days=30}={}){
 const calls=[];let revoked=false,used=false;
 const expiry=new Date(Date.now()+days*DAY).toISOString();
 const core={async fetch(request){
  const path=new URL(request.url).pathname;
  calls.push({path,method:request.method,auth:request.headers.get("authorization"),origin:new URL(request.url).origin,
    privateIngressAuthorized:request.headers.get("x-piner-core-service-key")===SERVICE_KEY});
  if(path==="/v1/piner-auth/challenges"&&request.method==="POST"){
   if(!upstream)return reply({},404);
   const body=await request.json();assert.equal(body.identifierType,"PHONE");assert.equal(body.identifierValue,PHONE);
   return reply({challengeId:UUID,expiresAt:new Date(Date.now()+5*60_000).toISOString()},202);
  }
  if(path==="/v1/piner-auth/challenges/"+UUID+"/verify"&&request.method==="POST"){
   if(!upstream)return reply({},404);
   const body=await request.json();
   if(body.otp!=="123456"||used)return reply({},401);
   used=true;return reply({token:TOKEN,expiresAt:expiry});
  }
  if(path==="/v1/member/session"&&request.method==="GET"){
   if(revoked||request.headers.get("authorization")!=="Bearer "+TOKEN)return reply({},401);
   return reply({parent:{id:"synthetic-parent"},session:{id:"synthetic-session",expiresAt:expiry}});
  }
  if(path==="/v1/member/students"&&request.method==="GET"){
   if(revoked)return reply({},403);
   return reply([{id:"synthetic-child",centerId:"synthetic-center"}]);
  }
  if(path==="/v1/member/session/logout"&&request.method==="POST"){
   assert.ok(request.headers.get("Idempotency-Key"));revoked=true;return reply({revoked:true});
  }
  return reply({},404);
 }};
 const env={PINER_AUTH_STAGING_ENABLED:enabled?"true":"false",PINO_MEMBER_CORE:core,
  PINER_AUTH_CORE_SERVICE_KEY:SERVICE_KEY,
  ...(seal?{PINER_SESSION_SEAL_KEY:Buffer.alloc(32,7).toString("base64url")}:{}),
  ...(rate?{PINER_AUTH_RATE_GUARD:limiter()}:{})};
 return {env,calls,get revoked(){return revoked}};
}
test("disabled flag never contacts Core",async()=>{
 const f=fixture({enabled:false});const r=await handlePinerAuth(post("/otp/request",{phone:PHONE}),f.env);
 assert.equal(r.status,503);assert.equal(f.calls.length,0);assert.equal(r.headers.get("set-cookie"),null);
});
test("missing seal or limiter fails closed before Core",async()=>{
 for(const opts of [{seal:false},{rate:false}]){
  const f=fixture(opts);const r=await handlePinerAuth(post("/otp/request",{phone:PHONE}),f.env);
  assert.equal(r.status,503);assert.equal(f.calls.length,0);
 }
});
test("cross-origin, no Origin, invalid phone and oversized body are denied",async()=>{
 const f=fixture();
 assert.equal((await handlePinerAuth(post("/otp/request",{phone:PHONE},{crossSite:true}),f.env)).status,403);
 assert.equal((await handlePinerAuth(post("/otp/request",{phone:PHONE},{origin:false}),f.env)).status,403);
 assert.equal((await handlePinerAuth(post("/otp/request",{phone:"111"}),f.env)).status,400);
 assert.equal((await handlePinerAuth(post("/otp/request",{phone:PHONE,extra:"x"}),f.env)).status,400);
 assert.equal((await handlePinerAuth(post("/otp/request",{phone:PHONE,extra:"x".repeat(3000)}),f.env)).status,400);
 assert.equal(f.calls.length,0);
});
test("OTP request normalizes synthetic VN phone; protected Core staging only, cooldown 429",async()=>{
 const f=fixture();
 const r=await handlePinerAuth(post("/otp/request",{phone:"0901234567"}),f.env);
 assert.equal(r.status,202);const data=(await r.json()).data;
 assert.deepEqual(Object.keys(data).sort(),["challengeId","expiresAt"]);
 assert.equal(data.challengeId,UUID);
 assert.match(r.headers.get("set-cookie"),/__Host-piner_device=.*Secure; HttpOnly/);
 assert.equal(f.calls[0].origin,"https://core-staging.internal");
 assert.equal(f.calls[0].privateIngressAuthorized,true);
 const next=await handlePinerAuth(post("/otp/request",{phone:PHONE}),f.env);
 assert.equal(next.status,429);assert.equal(f.calls.length,1);
 assert.equal(f.env.PINER_AUTH_RATE_GUARD.keys.some(k=>k.includes(PHONE)||k.includes("198.51.100.42")),false);
});
test("default Core 404 never reports successful OTP",async()=>{
 const f=fixture({upstream:false});
 const r=await handlePinerAuth(post("/otp/request",{phone:PHONE}),f.env);
 assert.equal(r.status,503);assert.equal(r.headers.get("set-cookie"),null);
});
test("verify seals bearer in 30d host-only cookie, session and children use current Core ACL",async()=>{
 const f=fixture();
 const r=await handlePinerAuth(post("/otp/verify",{challengeId:UUID,otp:"123456"}),f.env);
 assert.equal(r.status,200);
 assert.equal((await r.text()).includes(TOKEN),false);
 const cookie=r.headers.get("set-cookie");
 assert.match(cookie,/^__Host-piner_session=/);assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);
 assert.equal(cookie.includes(TOKEN),false);
 const scoped=cookie.split(";")[0];
 const session=await handlePinerAuth(get("/session",{cookie:scoped}),f.env);
 assert.equal(session.status,200);assert.equal((await session.json()).data.parent.id,"synthetic-parent");
 const children=await handlePinerAuth(get("/children",{cookie:scoped}),f.env);
 assert.equal(children.status,200);assert.deepEqual((await children.json()).data.map(x=>x.id),["synthetic-child"]);
 assert.ok(f.calls.every(x=>x.origin==="https://core-staging.internal"));
 assert.ok(f.calls.filter(x=>x.path.startsWith("/v1/member")).every(x=>x.auth==="Bearer "+TOKEN));
});
test("wrong OTP or expired/replayed challenge does not mint cookie",async()=>{
 const f=fixture();
 const r=await handlePinerAuth(post("/otp/verify",{challengeId:UUID,otp:"999999"}),f.env);
 assert.equal(r.status,401);assert.equal(r.headers.get("set-cookie"),null);
});
test("a legacy 90-day Core token fails Piner 30-day gate",async()=>{
 const f=fixture({days:90});
 const r=await handlePinerAuth(post("/otp/verify",{challengeId:UUID,otp:"123456"}),f.env);
 assert.equal(r.status,503);assert.equal(r.headers.get("set-cookie"),null);
});
test("invalid cookie 401, and 30-day absolute session expiration",async()=>{
 const f=fixture();
 const bad=await handlePinerAuth(get("/session",{cookie:"__Host-piner_session=bad.invalid"}),f.env);
 assert.equal(bad.status,401);assert.match(bad.headers.get("set-cookie"),/Max-Age=0/);
 const issued=await handlePinerAuth(post("/otp/verify",{challengeId:UUID,otp:"123456"}),f.env);
 const cookie=issued.headers.get("set-cookie").split(";")[0],now=Date.now();
 assert.equal((await handlePinerAuth(get("/session",{cookie}),f.env,now+29*DAY)).status,200);
 assert.equal((await handlePinerAuth(get("/session",{cookie}),f.env,now+30*DAY+1000)).status,401);
});
test("logout revokes Core session, clears cookie, future access denied",async()=>{
 const f=fixture();
 const issued=await handlePinerAuth(post("/otp/verify",{challengeId:UUID,otp:"123456"}),f.env);
 const cookie=issued.headers.get("set-cookie").split(";")[0];
 const out=await handlePinerAuth(post("/logout",null,{cookie}),f.env);
 assert.equal(out.status,200);assert.equal(f.revoked,true);
 assert.match(out.headers.get("set-cookie"),/Max-Age=0/);
 assert.equal((await handlePinerAuth(get("/session",{cookie}),f.env)).status,401);
});
test("logout-all is explicitly unavailable until Core provides revocation contract",async()=>{
 const f=fixture();assert.equal((await handlePinerAuth(post("/logout-all",null),f.env)).status,501);
});
test("other paths do not open auth, and unsafe methods return 405",async()=>{
 const f=fixture();
 assert.equal(isPinerAuthPath("/api/piner/auth/session"),true);
 assert.equal(isPinerAuthPath("/api/piner/private"),false);
 assert.equal(await handlePinerAuth(req("/api/piner/private"),f.env),null);
 assert.equal((await handlePinerAuth(get("/otp/request"),f.env)).status,405);
 assert.equal(f.calls.length,0);
});

test("PAP-1845: missing BFF private Core key fails closed before OTP egress",async()=>{
 const f=fixture();delete f.env.PINER_AUTH_CORE_SERVICE_KEY;
 const result=await handlePinerAuth(post("/otp/request",{phone:PHONE}),f.env);
 assert.equal(result.status,503);assert.equal(f.calls.length,0);
});
