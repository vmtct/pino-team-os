"use strict";
// PAP-2347 · Persistent native FE preview admission / PLT-M1-DELIVERY.
// Runtime registry under the canonical gateway directory. No listener or write operation.
const fs=require("node:fs");
const path=require("node:path");
const {createHash}=require("node:crypto");
const {createNativeM1Handler}=require("./native-m1-gateway.cjs");
const ORIGIN="http://desktop-isrdren:8800";
const digest=/^[a-f0-9]{64}$/;
const maxManifest=1024*1024;
function isNativeRequest(raw){
  if(typeof raw!=="string")return false;
  try{
    const url=new URL(raw,ORIGIN);
    return raw.includes("/__m1_assets/")||url.pathname.includes("/__m1_assets/")||
      (/^\/(bo|ho)\//.test(url.pathname)&&url.searchParams.has("m1Preview"));
  }catch{return raw.includes("/__m1_assets/")||raw.includes("m1Preview");}
}
function candidate(raw){
  if(isNativeRequest(raw))return true;
  try{return /^\/(bo|ho)\/.+/.test(new URL(raw,ORIGIN).pathname);}
  catch{return /^\/(bo|ho)\//.test(raw??"");}
}
function readRegular(file,max){
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw Error("Invalid registry file");
  const bytes=fs.readFileSync(file);
  if(bytes.length>max)throw Error("Registry file too large");
  return bytes;
}
function fixedChild(parent,child){
  const base=fs.realpathSync(parent),target=path.join(base,child);
  const stat=fs.lstatSync(target);
  if(stat.isSymbolicLink()||!stat.isDirectory())throw Error("Invalid registry directory");
  const real=fs.realpathSync(target);
  if(path.relative(base,real)!==child)throw Error("Registry directory escaped");
  return real;
}
function createRegistryDispatch(root){
  // Re-read the small registry on native requests; atomic replacement requires no restart.
  // Invalid inventory fails closed for potential module routes; top-level legacy paths remain unaffected.
  let cacheKey=null,dispatch=null;
  function native(req,res){
    if(!candidate(req.url))return false;
    try{
      const stat=fs.lstatSync(root);
      if(stat.isSymbolicLink()||!stat.isDirectory())throw Error("Invalid registry root");
      const bytes=readRegular(path.join(root,"registry.json"),maxManifest);
      const key=createHash("sha256").update(bytes).digest("hex");
      if(key!==cacheKey||!dispatch){
        const value=JSON.parse(bytes.toString("utf8"));
        if(value?.schemaVersion!==1||!Array.isArray(value.registrations)||value.registrations.length>32)
          throw Error("Invalid registry");
        const artifacts=value.registrations.length?fixedChild(root,"artifacts"):null;
        const entries=value.registrations.map(registration=>{
          if(!digest.test(registration?.artifact?.sha256??""))throw Error("Invalid artifact digest");
          return {registration,directory:fixedChild(artifacts,registration.artifact.sha256)};
        });
        dispatch=createNativeM1Handler(entries);
        cacheKey=key;
      }
      return dispatch(req,res);
    }catch{
      cacheKey=null;dispatch=null;
      res.writeHead(503,{"content-type":"text/plain; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex"});
      res.end(req.method==="HEAD"?undefined:"M1 registry unavailable");
    }
    return true;
  }
  native.blocksUpgrade=raw=>native({url:raw,method:"UPGRADE"},{writeHead(){},end(){}});
  return native;
}
module.exports={isNativeRequest,createRegistryDispatch};
