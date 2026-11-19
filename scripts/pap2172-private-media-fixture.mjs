// PAP-1598: controlled local React regression fixture, never Staging G4 evidence.
// Run from repository root. Synthetic responses exist only on this loopback server.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const postsReview = process.argv.includes("--posts-review");
// PAP-2124 #37944: exact i5 Ethernet address; legacy fixture stays loopback.
const reviewHost = process.argv.includes("--loopback") ? "127.0.0.1" : "192.168.1.6";
const reviewPort = process.argv.includes("--loopback") ? 8812 : 8810;
const output = resolve(postsReview ? ".next/pap2172-private-media-fixture" : ".next/pap1598-shell-fixture");
await mkdir(output, { recursive: true });
const navigation = `import React,{useSyncExternalStore} from 'react';
const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};
const change=href=>{const target=new URL(href,location.origin);for(const key of ['fixtureProduction','nested']){const value=new URLSearchParams(location.search).get(key);if(value)target.searchParams.set(key,value);}history.pushState({},'',target);dispatchEvent(new PopStateEvent('popstate'));};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/bo');
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));
export const useRouter=()=>({push:change,replace:change,refresh:()=>location.reload()});
export default function Link({href,children,prefetch,...props}){return <a href={href} {...props} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented){e.preventDefault();change(href)}}}>{children}</a>}`;

await build({...(postsReview ? {entryPoints:[resolve("scripts/fixtures/pap2172-private-media-entry.tsx")]} : {stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
import {usePathname,useSearchParams} from 'next/navigation';
import {BoApplicationShell} from './app/bo/shell/BoApplicationShell';
import {BoRuntimeBoundary,useBoStagingUser} from './app/bo/components/registration/BoRuntimeBoundary';
import {useBoCenterSelection} from './app/bo/components/registration/BoCenterSelection';
import {BoRegistrationWorkspace} from './app/bo/components/registration/BoRegistrationWorkspace';
import './public/bo-authority-source/bo-scoped.css';
import './app/bo/design-system/foundation.css';
const user={displayName:'Synthetic Manager',email:'shell-fixture@example.invalid'};
const source={modules:{students:{label:'Local route content',group:'SCHOOL',fields:[]}},scopeLabel:()=>'',load:async()=>{throw Error('Unexpected generic module load')}};
function Probe(){const user=useBoStagingUser(),center=useBoCenterSelection(),path=usePathname();return <section id='route-content' data-staging-user={!!user} data-content-center={!!center}><h1>Local route content</h1><p>{path}</p><button type='button' id='content-focus'>Content action</button></section>}
function App(){const query=useSearchParams(),staging=query.get('fixtureProduction')!=='1';const content=query.get('nested')==='1'?<BoRegistrationWorkspace source={source} currentUser={user} moduleKey='students' content={query.get('table')==='1'?undefined:<Probe/>}/>:<Probe/>;return <BoRuntimeBoundary currentUser={user} staging={staging}><BoApplicationShell currentUser={user} staging={staging}>{content}</BoApplicationShell></BoRuntimeBoundary>}
createRoot(document.getElementById('root')).render(<App/>);`,loader:'tsx',resolveDir:process.cwd()}}),
outfile:resolve(output,'fixture.js'),bundle:true,format:'esm',jsx:'automatic',loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},
plugins:[{name:'local-shell-fixture',setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:'navigation',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:navigation,loader:'jsx',resolveDir:process.cwd()}));
 b.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'fixture-image'}));
 b.onLoad({filter:/.*/,namespace:'fixture-image'},()=>({contents:"import React from 'react';export default function Image({unoptimized,priority,...props}){return <img {...props}/>}",loader:'jsx',resolveDir:process.cwd()}));
 b.onResolve({filter:/^next\/dynamic$/},()=>({path:'dynamic',namespace:'fixture-dynamic'}));
 b.onLoad({filter:/.*/,namespace:'fixture-dynamic'},()=>({contents:"export default function dynamic(){return function UnusedDomainModule(){return null}}",loader:'jsx'}));
}}]});

if(process.argv.includes('--build-only')) process.exit(0);
const centers=[{id:'019d2000-0001-7000-8000-000000000001',displayName:'Synthetic Center A'},{id:'019d2000-0001-7000-8000-000000000002',displayName:'Synthetic Center B'}];
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://localhost");
  if(postsReview){
   const remote=req.socket.remoteAddress||"";
   const lan=/^192\.168\.1\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(remote);
   const allowedPeer=reviewHost==="127.0.0.1"?remote==="127.0.0.1":lan;
   res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","no-referrer");
   res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
   if(!allowedPeer||req.headers.host!==reviewHost+":"+reviewPort||req.socket.localAddress!==reviewHost){res.writeHead(403);return res.end("Review LAN only");}
   if(!["GET","HEAD"].includes(req.method)){res.writeHead(403);return res.end("Local visual shell is read only");}
   if(!["/bo/piner-posts","/api/bo/centers","/fixture.js","/fixture.css"].includes(url.pathname)){res.writeHead(404);return res.end("Outside Posts review surface");}
  }
  if(url.pathname==='/api/bo/centers'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({data:centers}));}
  if(url.pathname.startsWith('/api/')){res.writeHead(403,{'content-type':'application/json'});return res.end(JSON.stringify({error:{message:'No business API in shell fixture'}}));}
  if(postsReview && url.pathname!=="/bo/piner-posts" && url.pathname.startsWith("/bo")){res.writeHead(404);return res.end("Only Posts is available in this local review");}
  if(url.pathname==='/bo'||url.pathname.startsWith('/bo/')){res.setHeader('content-type','text/html');return res.end('<!doctype html><html lang="vi" data-bo-ui-authority="v25"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>');}
  const path=resolve(output,'.'+url.pathname);if(!path.startsWith(output+sep))throw Error('outside fixture');
  res.setHeader('content-type',extname(path)==='.css'?'text/css':'text/javascript');res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
server.listen(postsReview?reviewPort:8898,postsReview?reviewHost:"127.0.0.1",()=>console.log(postsReview?"PAP2172_LOCAL_FIXTURE http://"+reviewHost+":"+reviewPort+"/bo/piner-posts (synthetic; LAN-only review, not authenticated runtime)":"PAP1598_LOCAL_FIXTURE http://127.0.0.1:8898/bo (synthetic; not Staging acceptance)"));
