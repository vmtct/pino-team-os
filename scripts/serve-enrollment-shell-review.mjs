/** PAP-2181 isolated synthetic native review. No API, no production ingress. */
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const local=process.argv.includes("--smoke"),host=local?"127.0.0.1":"192.168.1.6";
const port=local?0:Number(process.env.ENROLLMENT_REVIEW_PORT||8810);
const out=resolve(".next/pap2181-enrollment-shell");
await mkdir(out,{recursive:true});
const nav=`import React,{useSyncExternalStore} from 'react';
const sub=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};
const change=href=>{const u=new URL(href,location.origin);history.pushState({},'',u);dispatchEvent(new PopStateEvent('popstate'))};
export const usePathname=()=>useSyncExternalStore(sub,()=>location.pathname,()=>'/bo/enrollments');
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(sub,()=>location.search,()=>''));
export const useRouter=()=>({push:change,replace:change,refresh:()=>location.reload()});
export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}`;
await build({entryPoints:["scripts/fixtures/enrollment-shell-entry.tsx"],outfile:resolve(out,"fixture.js"),bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"enrollment-review",setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:"nav",namespace:"review"}));
 b.onLoad({filter:/.*/,namespace:"review"},()=>({contents:nav,loader:"jsx",resolveDir:process.cwd()}));
 b.onResolve({filter:/^next\/image$/},()=>({path:"image",namespace:"review-image"}));
 b.onLoad({filter:/.*/,namespace:"review-image"},()=>({contents:"import React from 'react';export default function Image({unoptimized,priority,...props}){return <img {...props}/>}",loader:"jsx",resolveDir:process.cwd()}));
 b.onResolve({filter:/^next\/dynamic$/},()=>({path:"dynamic",namespace:"review-dynamic"}));
 b.onLoad({filter:/.*/,namespace:"review-dynamic"},()=>({contents:"export default function dynamic(){return function Unused(){return null}}",loader:"jsx"}));
}}]});
console.log("PAP2181_BUILD_PASS");
if(process.argv.includes("--build-only"))process.exit(0);
const server=createServer(async(req,res)=>{
 try{
  const peer=req.socket.remoteAddress||"",allowed=local?peer==="127.0.0.1":/^192\.168\.1\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(peer);
  res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
  if(!allowed||req.socket.localAddress!==host||req.headers.host!==host+":"+server.address().port||!["GET","HEAD"].includes(req.method)){res.writeHead(403);return res.end();}
  const p=new URL(req.url,"http://localhost").pathname;
  if(p==="/bo/enrollments"){res.setHeader("content-type","text/html; charset=utf-8");return res.end('<!doctype html><html lang="vi" data-bo-ui-authority="v25"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lịch học</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>');}
  if(p==="/fixture.js"||p==="/fixture.css"){res.setHeader("content-type",p.endsWith(".css")?"text/css":"text/javascript");return res.end(await readFile(resolve(out,p.slice(1))));}
  res.writeHead(403);res.end();
 }catch{res.writeHead(404);res.end();}
});
server.listen(port,host,()=>console.log("PAP2181_REVIEW_READY http://"+host+":"+server.address().port+"/bo/enrollments"));
