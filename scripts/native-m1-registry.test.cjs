"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const vm=require("node:vm");
const {createHash}=require("node:crypto");
const {isNativeRequest,createRegistryDispatch}=require("./native-m1-registry.cjs");
const {patchGateway}=require("./prepare-native-m1-gateway.cjs");
const hash=b=>createHash("sha256").update(b).digest("hex");
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"pap2347-registry-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const artifacts=path.join(root,"artifacts");
  fs.mkdirSync(artifacts);
  function artifact(route,id,task,body){
    const bytes=Buffer.from(body);
    const files=[{path:"index.html",size:bytes.length,sha256:hash(bytes)}];
    const sha256=hash(JSON.stringify(files)), dir=path.join(artifacts,sha256);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,"index.html"),bytes);
    return {kind:"M1_OFFLINE_PREVIEW_REGISTRATION",schemaVersion:1,
      sourceRevision:"a".repeat(40),jiraTask:task,surface:route.split("/")[1],
      fixtureId:id,reviewUrl:"http://192.168.1.6:8800"+route+"?m1Preview=1",
      artifact:{sha256,files}};
  }
  function register(registrations){
    const temp=path.join(root,"registry.next.json");
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,registrations}));
    fs.renameSync(temp,path.join(root,"registry.json"));
  }
  return {root,artifacts,artifact,register};
}
function request(handler,url,method="GET"){
  let status,headers,body;
  const handled=handler({url,method},{writeHead(s,h){status=s;headers=h;},end(b){body=b;}});
  return {handled,status,headers,body:body?.toString()};
}
test("missing registry preserves ordinary traffic and fails closed for reserved routes",t=>{
  const f=fixture(t),handler=createRegistryDispatch(f.root);
  for(const route of ["/","/bo","/ho?module=staffs","/tos","/website","/mytime","/healthz","/ho/staff?record=STAFF-MOCK-001"])
    assert.equal(request(handler,route).handled,false);
  assert.equal(request(handler,"/ho/staff?m1Preview=1").status,503);
  assert.equal(request(handler,"/ho/staff/__m1_assets/app.js").status,503);
});
test("two independent feature registrations and restart-free replacement",t=>{
  const f=fixture(t),handler=createRegistryDispatch(f.root);
  const staff=f.artifact("/ho/staff","STAFF-MOCK-001","PAP-2353","staff shell");
  const role=f.artifact("/ho/roles","ROLE-MOCK-001","PAP-2192","role shell");
  f.register([staff,role]);
  assert.equal(request(handler,"/ho/staff?m1Preview=1").body,"staff shell");
  assert.equal(request(handler,"/ho/roles?m1Preview=1").body,"role shell");
  assert.equal(request(handler,"/ho/staff?m1Preview=1&record=ROLE-MOCK-001").status,404);
  assert.equal(request(handler,"/ho/roles?m1Preview=1","POST").status,405);
  assert.equal(request(handler,"/bo/unregistered?m1Preview=1").status,404);
  f.register([role]);
  assert.equal(request(handler,"/ho/staff?m1Preview=1").status,404);
  assert.equal(request(handler,"/ho/roles?m1Preview=1").body,"role shell");
  assert.equal(request(createRegistryDispatch(f.root),"/ho/roles?m1Preview=1").body,"role shell");
});
test("tampered registry/artifact fails closed, legacy unaffected",t=>{
  const f=fixture(t),handler=createRegistryDispatch(f.root);
  const staff=f.artifact("/ho/staff","STAFF-MOCK-001","PAP-2353","staff shell");
  f.register([staff]);
  assert.equal(request(handler,"/ho/staff?m1Preview=1").status,200);
  fs.writeFileSync(path.join(f.artifacts,staff.artifact.sha256,"index.html"),"other shell");
  assert.equal(request(handler,"/ho/staff?m1Preview=1").status,503);
  f.register([{...staff,artifact:{...staff.artifact,sha256:"../outside"}}]);
  assert.equal(request(handler,"/ho/staff?m1Preview=1").status,503);
  assert.equal(request(handler,"/ho").handled,false);
});
test("reserved query and asset detection for HTTP and upgrade",()=>{
  for(const url of ["/ho/staff?m1Preview=1","/bo/sales/leads?m1Preview=0","/ho/roles/__m1_assets/app.js","/ho/staff/__m1_assets/../x","/ho/staff?%6d1Preview=1"])assert.equal(isNativeRequest(url),true,url);
  for(const url of ["/ho","/bo","/tos","/healthz","/ho/staff?record=STAFF-MOCK-001"])assert.equal(isNativeRequest(url),false,url);
});
test("exact gateway patch preserves LAN first, legacy fallback and upgrade guard",()=>{
  const original=Buffer.from([
    'const path = require("node:path");',
    'const server = http.createServer((req,res) => {',
    '  if (!clientAllowed(req.socket)) return report(res, 403, "LAN only");',
    '  legacy(req,res);',
    '});',
    'server.on("upgrade",(req,socket,head)=>{',
    '  if (!clientAllowed(socket)) return socket.destroy();',
    '  legacyUpgrade(req,socket,head);',
    '});'
  ].join("\n"));
  assert.throws(()=>patchGateway(original,"0".repeat(64)),/baseline changed/);
  const candidate=patchGateway(original,hash(original));
  let onRequest,onUpgrade,legacyCalls=0,upgradeCalls=0;
  const context={require:id=>id==="node:path"?path:{isNativeRequest,createRegistryDispatch:()=>req=>isNativeRequest(req.url)},
    __dirname:"/example",http:{createServer:cb=>{onRequest=cb;return {on:(event,cb)=>{assert.equal(event,"upgrade");onUpgrade=cb;}}}},
    clientAllowed:socket=>socket.lan,report:res=>{res.denied=true;},legacy:()=>legacyCalls++,legacyUpgrade:()=>upgradeCalls++};
  vm.runInNewContext(candidate.toString(),context);
  const response={};
  onRequest({socket:{lan:false},url:"/ho/staff?m1Preview=1"},response);
  assert.equal(response.denied,true);
  onRequest({socket:{lan:true},url:"/ho/staff?m1Preview=1"},{});
  onRequest({socket:{lan:true},url:"/ho"},{});
  assert.equal(legacyCalls,1);
  let destroyed=0;
  onUpgrade({url:"/ho/roles?m1Preview=1"},{lan:true,destroy(){destroyed++;}});
  onUpgrade({url:"/ho/_next/webpack-hmr"},{lan:true,destroy(){destroyed++;}});
  assert.equal(destroyed,1);
  assert.equal(upgradeCalls,1);
});
