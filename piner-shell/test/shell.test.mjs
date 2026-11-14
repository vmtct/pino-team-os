import test from "node:test";
import assert from "node:assert/strict";
import {PROGRAMS,TABS,parseRoute,routeFor,getShellAdapter,assertFailClosed} from "../src/adapter.mjs";
import {handleRequest} from "../src/worker.mjs";
const host="https://app.pinohouse.art";
const req=(path,method="GET")=>new Request(host+path,{method});
const fixture={PINER_BRAND_R2:{
 async get(key){
  if(!["piner_journey_background.png","piner_mytime_background.png","piner_mobile_shell_background.png","piner_app_logo_no_yellow_transparent.png"].includes(key))return null;
  return {body:new Blob(["fixture-public-r2"]).stream(),httpEtag:'"public-r2"',writeHttpMetadata(h){h.set("Content-Type","image/png")}};
 }
}};
test("01 contract: programs/tabs and canonical internal routes",()=>{
 assert.deepEqual(Object.keys(PROGRAMS),["house","mytime"]);
 assert.equal(PROGRAMS.house.label,"PINO Afterschool");
 assert.equal(PROGRAMS.mytime.label,"MyTime by PINO");
 assert.equal(TABS.length,4);
 assert.equal(routeFor("house","community"),"/piner/house/community");
 assert.deepEqual(parseRoute("/piner/mytime/reels"),{kind:"member",space:"mytime",tab:"reels"});
 assert.deepEqual(parseRoute("/"),{kind:"launcher"});
 assert.equal(parseRoute("/piner/public"),null);
 assert.equal(parseRoute("/api/member"),null);
});
test("02 fail closed: no actor, Center, student, media, posts, grants",()=>{
 const s=getShellAdapter();
 assert.equal(s.state,"unauthenticated");
 for(const k of ["actor","center"])assert.equal(s[k],null);
 for(const k of ["children","posts","media","grants"])assert.deepEqual(s[k],[]);
 assert.equal(assertFailClosed(s),s);
 assert.throws(()=>assertFailClosed({...s,posts:[{id:"student"}]}));
});
test("03 launcher and both app experiences return secure, noindex HTML",async()=>{
 for(const p of ["/","/piner","/piner/house","/piner/house/grid","/piner/mytime","/piner/mytime/reels","/piner/house/community"]){
  const r=await handleRequest(req(p),fixture);assert.equal(r.status,200,p);
  assert.match(r.headers.get("Content-Type"),/text\/html/);
  assert.match(r.headers.get("X-Robots-Tag"),/noindex/);
  assert.match(r.headers.get("Content-Security-Policy"),/connect-src 'none'/);
  const html=await r.text();
  assert.match(html,/data-runtime="fe-only"/,p);
  assert.doesNotMatch(html,/(Minh An|Gia Bình|Bé An|Bé Bình|PINO Piano.*đã đăng)/,p);
  if(p.includes("/community"))assert.doesNotMatch(html,/<h1>Cộng đồng<\/h1>/);
 }
});
test("04 404 private/public/unknown API and 405 writes",async()=>{
 for(const p of ["/piner/public","/piner/public/post/p5","/api/piner/context","/piner/house/unknown"]){
  const r=await handleRequest(req(p),fixture);
  assert.equal(r.status,404,p);
 }
 for(const method of ["POST","PUT","PATCH","DELETE"]){
  const r=await handleRequest(req("/piner/house",method),fixture);
  assert.equal(r.status,405,method);
 }
});
test("05 prior R2 image URLs supported in read-only fallback",async()=>{
 for(const p of ["piner_journey_background.png","piner_mytime_background.png","piner_mobile_shell_background.png","piner_app_logo_no_yellow_transparent.png"]){
  const r=await handleRequest(req("/"+p),fixture);
  assert.equal(r.status,200,p);
  assert.match(r.headers.get("Content-Type"),/image\/png/);
  assert.equal(await r.text(),"fixture-public-r2");
  const head=await handleRequest(req("/"+p,"HEAD"),fixture);
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
 }
 const miss=await handleRequest(req("/missing.png"),fixture);assert.equal(miss.status,404);
 const unavailable=await handleRequest(req("/piner_journey_background.png"),{});assert.equal(unavailable.status,503);
});
test("06 script, CSS available; HEAD never carries body",async()=>{
 for(const p of ["/piner-shell.css","/piner-shell.js"]){
  const r=await handleRequest(req(p),fixture);
  assert.equal(r.status,200,p);
  assert.match(await r.text(),/Piner|piner|chromeCollapsed|card-photo/);
  const head=await handleRequest(req(p,"HEAD"),fixture);
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
 }
});

test("PAP-1962 launcher title width contract is scoped to Afterschool", async () => {
 const response=await handleRequest(req("/"),fixture);
 const html=await response.text();
 assert.match(html, /class="pino-word">PINO<\/span> <span class="afterschool-word">Afterschool<\/span>/);
 assert.match(html, /MyTime<small>by PINO<\/small>/);
 assert.match(html, /Hết giờ học,<br>đến giờ con khám phá\./);
 const sheet=await handleRequest(req("/piner-shell.css"),fixture);
 const css=await sheet.text();
 assert.match(css, /\.house \.card-copy strong \.afterschool-word\{font-size:\.4244em;letter-spacing:-\.06em;/);
 assert.match(css, /\.house \.card-copy strong \.pino-word,\.house \.card-copy strong \.afterschool-word\{display:block\}/);
 assert.doesNotMatch(css,/\.mytime \.card-copy strong \.afterschool-word/);
});