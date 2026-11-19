// PAP-2161 / MT-WORKSHOP. Native UI review only. No authenticated product routes or business API.
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),output=resolve(root,".next/pap2161-workshop-review");
await mkdir(output,{recursive:true});
const nav=`import React,{useSyncExternalStore} from 'react';
const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};
const change=href=>{location.assign(new URL(href,location.origin));};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/ho/mytime-workshops');
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));
export const useRouter=()=>({push:change,replace:change,refresh:()=>location.reload()});
export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}`;
await build({absWorkingDir:root,entryPoints:["scripts/fixtures/mytime-workshop-entry.tsx"],outfile:resolve(output,"fixture.js"),bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"local-workshop-review",setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:"navigation",namespace:"fixture"}));
 b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:nav,loader:"jsx",resolveDir:root}));
 b.onResolve({filter:/^next\/image$/},()=>({path:"image",namespace:"fixture-image"}));
 b.onLoad({filter:/.*/,namespace:"fixture-image"},()=>({contents:"import React from 'react';export default function Image({unoptimized,priority,...props}){return <img {...props}/>}",loader:"jsx",resolveDir:root}));
 b.onResolve({filter:/^next\/dynamic$/},()=>({path:"dynamic",namespace:"fixture-dynamic"}));
 b.onLoad({filter:/.*/,namespace:"fixture-dynamic"},()=>({contents:"export default function dynamic(){return function UnusedDomainModule(){return null}}",loader:"jsx",resolveDir:root}));
}}]});
if(process.argv.includes("--build-only"))process.exit(0);
const lan=process.argv.includes("--lan"),port=Number(process.argv.find(x=>x.startsWith("--port="))?.split("=")[1]??8810);
if(!Number.isInteger(port)||port<8810||port>8899)throw Error("Invalid review port");
const bind=lan?"192.168.1.6":"127.0.0.1";
const centers=[{id:"019d2161-0000-7000-8000-000000000001",displayName:"PINO House A"},{id:"019d2161-0000-7000-8000-000000000002",displayName:"PINO House B"}];
const html=ho=>'<!doctype html><html lang="vi" '+(ho?'data-surface="ho"':'data-bo-ui-authority="v25"')+'><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>';
const server=createServer(async(req,res)=>{
 const peer=req.socket.remoteAddress??"",host=req.headers.host;
 res.setHeader("cache-control","no-store");res.setHeader("x-content-type-options","nosniff");
 if(req.socket.localAddress!==bind||host!==bind+":"+port||(lan?!/^192\.168\.1\.[0-9]{1,3}$/.test(peer):peer!=="127.0.0.1")||!["GET","HEAD"].includes(req.method)){res.writeHead(403);res.end();return;}
 try{
 const path=new URL(req.url,"http://"+bind+":"+port).pathname;
 const send=(ct,data)=>{res.setHeader("content-type",ct);res.end(req.method==="HEAD"?undefined:data);};
 if(path==="/ho/mytime-workshops"||path==="/bo/mytime-workshops")return send("text/html; charset=utf-8",html(path.startsWith("/ho/")));
 if(path==="/api/bo/centers")return send("application/json",JSON.stringify({data:centers}));
 if(path==="/fixture.js"||path==="/fixture.css")return send(path.endsWith(".css")?"text/css":"text/javascript",await readFile(resolve(output,path.slice(1))));
 res.writeHead(path.startsWith("/api/")?403:404);res.end();
 }catch{res.writeHead(404);res.end();}
});
server.listen(port,bind,()=>console.log("PAP-2161 synthetic review "+bind+":"+port+" /ho/mytime-workshops /bo/mytime-workshops"));
