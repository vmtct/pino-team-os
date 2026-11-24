"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {createHash}=require("node:crypto");
const {mkdtempSync,writeFileSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const {createNativeM1Handler}=require("./native-m1-gateway.cjs");
const hash=x=>createHash("sha256").update(x).digest("hex");
const origin="http://192.168.1.6:8800";
const route="/ho/staff";
function fixture(t){
 const directory=mkdtempSync(join(tmpdir(),"pap2347-"));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const assets={"index.html":"<html>synthetic test only</html>","app.js":"console.log('test')","app.css":"body{}"};
 const files=Object.entries(assets).map(([path,data])=>{const b=Buffer.from(data);writeFileSync(join(directory,path),b);return {path,size:b.length,sha256:hash(b)};}).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const registration={schemaVersion:1,kind:"M1_OFFLINE_PREVIEW_REGISTRATION",jiraTask:"PAP-2353",surface:"ho",fixtureId:"STAFF-MOCK-001",sourceRevision:"a".repeat(40),reviewUrl:origin+route+"?m1Preview=1",artifact:{files,sha256:hash(JSON.stringify(files))}};
 return {registration,directory};
}
function request(handler,url,method="GET"){
 const response={status:null,headers:{},body:undefined};
 const handled=handler({url,method},{writeHead(status,headers){response.status=status;response.headers=headers;},end(body){response.body=body;}});
 return {handled,...response};
}
test("existing ordinary routes fall through; only pinned preview is served",t=>{
 const h=createNativeM1Handler([fixture(t)]);
 for(const url of ["/bo","/ho","/ho?module=staffs","/ho/staff","/tos","/website","/piner","/mytime","/healthz"])assert.equal(request(h,url).handled,false,url);
 const r=request(h,route+"?m1Preview=1");
 assert.equal(r.status,200);assert.equal(r.headers["x-pino-source-revision"],"a".repeat(40));assert.match(r.headers["content-security-policy"],/connect-src 'none'/);assert.match(r.headers["content-security-policy"],/sandbox allow-scripts/);
 assert.equal(request(h,route+"?m1Preview=1&record=STAFF-MOCK-001").status,200);
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
