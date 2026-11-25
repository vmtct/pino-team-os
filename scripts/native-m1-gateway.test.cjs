"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {createHash}=require("node:crypto");
const {mkdtempSync,writeFileSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const {createNativeM1Handler}=require("./native-m1-gateway.cjs");
const hash=x=>createHash("sha256").update(x).digest("hex");
const origin="http://desktop-isrdren:8800";
const route="/ho/staff";
function fixture(t){
 const directory=mkdtempSync(join(tmpdir(),"pap2347-"));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const assets={"index.html":"<html>synthetic test only</html>","app.js":"console.log('test')","app.css":"body{}"};
 const files=Object.entries(assets).map(([path,data])=>{const b=Buffer.from(data);writeFileSync(join(directory,path),b);return {path,size:b.length,sha256:hash(b)};}).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const registration={schemaVersion:1,kind:"M1_OFFLINE_PREVIEW_REGISTRATION",jiraTask:"PAP-2353",surface:"ho",fixtureId:"STAFF-MOCK-001",sourceRevision:"a".repeat(40),reviewUrl:origin+route,artifact:{files,sha256:hash(JSON.stringify(files))}};
 return {registration,directory};
}
function request(handler,url,method="GET"){
 const response={status:null,headers:{},body:undefined};
 const handled=handler({url,method,headers:{host:"desktop-isrdren:8800"}},{writeHead(status,headers){response.status=status;response.headers=headers;},end(body){response.body=body;}});
 return {handled,...response};
}
test("existing ordinary routes fall through; only pinned preview is served",t=>{
 const h=createNativeM1Handler([fixture(t)]);
 for(const url of ["/bo","/ho","/ho?module=staffs","/tos","/website","/piner","/mytime","/healthz"])assert.equal(request(h,url).handled,false,url);
 const r=request(h,route);
 assert.equal(r.status,200);assert.equal(r.headers["x-pino-source-revision"],"a".repeat(40));assert.match(r.headers["content-security-policy"],/connect-src 'none'/);assert.match(r.headers["content-security-policy"],/sandbox allow-scripts/);
 assert.equal(request(h,route+"?record=STAFF-MOCK-001").status,200);
 assert.equal(request(h,route+"/__m1_assets/app.css").headers["content-type"],"text/css; charset=utf-8");
 assert.equal(request(h,route+"/__m1_assets/app.js","HEAD").body,undefined);
});
test("unknown preview, real record, extra query, mutation and unlisted asset denied",t=>{
 const h=createNativeM1Handler([fixture(t)]);
 for(const url of ["/bo/leads?m1Preview=1",route+"?m1Preview=0",route+"?m1Preview=1&record=real",route+"?m1Preview=1&extra=1",route+"?m1Preview=1&m1Preview=1",route+"/__m1_assets/secret.json",route+"/__m1_assets/app.js?x=1",route+"/__m1_assets/../outside",route+"/__m1_assets/%2e%2e/outside"])assert.equal(request(h,url).status,404,url);
 assert.equal(request(h,route+"?m1Preview=1","POST").status,405);
});
test("tampered artifact fails closed and invalid registration rejected",t=>{
 const f=fixture(t),h=createNativeM1Handler([f]);
 writeFileSync(join(f.directory,"app.js"),"changed");
 assert.equal(request(h,route+"/__m1_assets/app.js").status,503);
 assert.throws(()=>createNativeM1Handler([f,f]));
 assert.throws(()=>createNativeM1Handler([{...f,registration:{...f.registration,reviewUrl:"https://ho.staging.pinohouse.art/ho/staff?m1Preview=1"}}]));
 assert.throws(()=>createNativeM1Handler([{...f,registration:{...f.registration,artifact:{...f.registration.artifact,sha256:"b".repeat(64)}}}]));
});

test("legacy selectors normalize, exact fixture identity, and historical registration fails closed",t=>{
 const f=fixture(t),h=createNativeM1Handler([f]);
 assert.equal(request(h,route+"?m1Preview=1&record=STAFF-MOCK-001").headers.location,route+"?record=STAFF-MOCK-001");
 assert.equal(request(h,route+"?m1Preview=1").status,308);
 assert.equal(request(h,route+"?record=STAFF-MOCK-002").status,404);
 f.registration.reviewUrl="http://192.168.1.6:8800"+route+"?m1Preview=1";
 const old=createNativeM1Handler([f]);
 assert.equal(request(old,route).status,503);
 assert.equal(request(old,route+"?m1Preview=1").status,308);
 assert.equal(request(old,route+"/__m1_assets/app.js").status,503);
});
test("untrusted host denied, MagicDNS CSP scoped to exact host",t=>{
 const h=createNativeM1Handler([fixture(t)]);
 function at(host){let status,headers;h({url:route,method:"GET",headers:{host}},{writeHead(s,h){status=s;headers=h;},end(){}});return {status,headers};}
 assert.equal(at("evil.invalid:8800").status,404);
 const result=at("desktop-isrdren.tail3ee007.ts.net:8800");
 assert.equal(result.status,200);
 assert.match(result.headers["content-security-policy"],/http:\/\/desktop-isrdren\.tail3ee007\.ts\.net:8800\/ho\/staff\/__m1_assets\//);
});
test("aliases and normalized dot paths cannot fall through to a live module",t=>{
 const h=createNativeM1Handler([fixture(t)]);
 for(const raw of ["/ho/staff/","/ho/%73taff","/ho/STAFF","/ho/other/../staff","/ho//staff"])
   assert.equal(request(h,raw).status,404,raw);
});