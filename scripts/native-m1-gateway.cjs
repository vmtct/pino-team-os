"use strict";
// PAP-2347 / PLT-M1-DELIVERY. Offline candidate for the existing i5 gateway.
// No listener, auth session, publisher, network proxy or live activation here.
const {createHash}=require("node:crypto");
const {readFileSync,lstatSync,realpathSync}=require("node:fs");
const path=require("node:path");
const ORIGIN="http://desktop-isrdren:8800";
const reviewOrigins=new Set([ORIGIN,"http://desktop-isrdren.tail3ee007.ts.net:8800","http://192.168.1.6:8800"]); // legacy registration metadata only
function requestOrigin(req){
  const host=String(req.headers?.host||"").toLowerCase();
  if(host==="desktop-isrdren:8800"||host==="desktop-isrdren.tail3ee007.ts.net:8800"||host==="127.0.0.1:8800")return "http://"+host;
  const local=String(req.socket?.localAddress||"").replace(/^::ffff:/,"");
  if(host===local+":8800"&&(/^(?:192\.168\.1\.\d{1,3}|100\.104\.247\.34)$/.test(local)))return "http://"+host;
  return null;
}
const sha256=/^[a-f0-9]{64}$/;
const revision=/^[a-f0-9]{40}$/;
const routePattern=/^\/(?:bo|ho)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/;
const assetPattern=/^[A-Za-z0-9_-]+(?:[./-][A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$/;
const types=Object.freeze({".js":"application/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".woff2":"font/woff2",".woff":"font/woff"});
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const safeAsset=p=>typeof p==="string"&&assetPattern.test(p)&&p.split("/").every(s=>s&&s!=="."&&s!=="..")&&Object.hasOwn(types,path.extname(p));
const MAX=16*1024*1024;
function prepareRegistration(registration, directory){
  const r=registration;
  if(r?.kind!=="M1_OFFLINE_PREVIEW_REGISTRATION"||r.schemaVersion!==1||!revision.test(r.sourceRevision??"")||
     !/^PAP-[1-9][0-9]*$/.test(r.jiraTask??"")||!["bo","ho"].includes(r.surface)||
     !/^[A-Z][A-Z0-9-]*-MOCK-001$/.test(r.fixtureId??"")) throw Error("Invalid registration");
  const url=new URL(r.reviewUrl);
  if(!reviewOrigins.has(url.origin)||url.username||url.password||url.hash||!routePattern.test(url.pathname)||
     !url.pathname.startsWith("/"+r.surface+"/")||/(?:^|\/)(?:api|auth|login|logout|admin|server)(?:\/|$)/.test(url.pathname)||
     !(url.search===""&&url.origin===ORIGIN||url.search==="?m1Preview=1"&&reviewOrigins.has(url.origin))) throw Error("Invalid preview route");
  if(!Array.isArray(r.artifact?.files)||!r.artifact.files.length||r.artifact.files.length>256||
     !sha256.test(r.artifact.sha256??"")) throw Error("Invalid artifact inventory");
  const files=new Map();
  const inventory=r.artifact.files.map(f=>{
    if(!(f.path==="index.html"||safeAsset(f.path))||!Number.isSafeInteger(f.size)||f.size<=0||f.size>MAX||!sha256.test(f.sha256??"")) throw Error("Invalid artifact file");
    if([...files.keys()].some(p=>p.toLowerCase()===f.path.toLowerCase())) throw Error("Ambiguous file");
    const record={path:f.path,size:f.size,sha256:f.sha256};files.set(f.path,record);return record;
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(!files.has("index.html")||hash(JSON.stringify(inventory))!==r.artifact.sha256) throw Error("Inventory digest mismatch");
  const root=realpathSync(directory);
  if(!lstatSync(directory).isDirectory()||lstatSync(directory).isSymbolicLink()) throw Error("Invalid artifact root");
  const prefix=url.pathname+"/__m1_assets/";
  return {route:url.pathname,prefix,root,files,sourceRevision:r.sourceRevision,fixtureId:r.fixtureId,legacy:url.search!=="",artifactDigest:r.artifact.sha256};
}
function readPinned(entry,name){
  const f=entry.files.get(name);
  if(!f) return null;
  const target=path.join(entry.root,...name.split("/"));
  const stat=lstatSync(target);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size!==f.size) throw Error("Artifact file changed");
  const real=realpathSync(target), relative=path.relative(entry.root,real);
  if(path.isAbsolute(relative)||relative===".."||relative.startsWith(".."+path.sep)) throw Error("Artifact path escaped");
  const bytes=readFileSync(real);
  if(bytes.length!==f.size||hash(bytes)!==f.sha256) throw Error("Artifact digest mismatch");
  return bytes;
}
function createNativeM1Handler(registrations){
  const entries=registrations.map(({registration,directory})=>prepareRegistration(registration,directory));
  if(new Set(entries.map(x=>x.route)).size!==entries.length) throw Error("Duplicate route");
  return function handle(req,res){
    const raw=req.url||"/";
    let url;
    try{url=new URL(raw,ORIGIN);}catch{return false;}
    const entry=entries.find(x=>url.pathname===x.route||url.pathname.startsWith(x.prefix));
    let alias=url.pathname;
    try{alias=decodeURIComponent(alias).replace(/\/+/g,"/").replace(/\/$/,"").toLowerCase();}catch{}
    const aliasReserved=entries.some(x=>alias===x.route||alias.startsWith(x.prefix));
    const reserved=raw.includes("/__m1_assets/")||url.pathname.includes("/__m1_assets/")||routePattern.test(url.pathname)&&url.searchParams.has("m1Preview");
    if(!entry&&!reserved&&!aliasReserved)return false;
    const respond=(code,body,headers={})=>{
      res.writeHead(code,{"cache-control":"no-store","x-robots-tag":"noindex","x-content-type-options":"nosniff",...headers});
      res.end(req.method==="HEAD"?undefined:body);return true;
    };
    if(req.method!=="GET"&&req.method!=="HEAD")return respond(405,"Read-only M1 artifact",{allow:"GET, HEAD"});
    if(!entry||raw.split("?")[0]!==url.pathname||url.origin!==ORIGIN||!raw.startsWith("/")||raw.startsWith("//")||/[\\%]/.test(raw))return respond(404,"Unknown M1 artifact");
    const servingOrigin=requestOrigin(req);
    if(!servingOrigin)return respond(404,"Unknown M1 host");
    const page=url.pathname===entry.route;
    if(page){
      const query=url.searchParams;
      const record=query.get("record");
      if(query.getAll("m1Preview").length>1||(query.has("m1Preview")&&query.get("m1Preview")!=="1")||
         [...query.keys()].some(k=>!["m1Preview","record"].includes(k))||query.getAll("record").length>1||
         (record!==null&&record!==entry.fixtureId))return respond(404,"Unknown M1 review");
      if(query.has("m1Preview"))return respond(308,"Canonical M1 route",{location:entry.route+(record?"?record="+record:"")});
    }else if(url.search||!safeAsset(url.pathname.slice(entry.prefix.length)))return respond(404,"Unknown M1 asset");
    // Historical artifacts embed an obsolete fixed-origin/query guard. Preserve their
    // receipts and route reservation, but never pretend they render or proxy live data.
    if(entry.legacy)return respond(503,"M1 artifact requires canonical source rebuild");
    const name=page?"index.html":url.pathname.slice(entry.prefix.length);
    try{
      const body=readPinned(entry,name);
      if(!body)return respond(404,"Unknown M1 asset");
      const assets=servingOrigin+entry.prefix;
      const policy="sandbox allow-scripts; default-src 'none'; script-src "+assets+"; style-src "+assets+" 'unsafe-inline'; img-src "+assets+" data:; font-src "+assets+"; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
      return respond(200,body,{"content-type":(page?"text/html":types[path.extname(name)])+"; charset=utf-8","content-length":body.length,
        "content-security-policy":policy,"referrer-policy":"no-referrer","x-pino-source-revision":entry.sourceRevision,"x-pino-artifact-sha256":entry.artifactDigest});
    }catch{return respond(503,"M1 artifact failed integrity check");}
  };
}
module.exports={createNativeM1Handler};
