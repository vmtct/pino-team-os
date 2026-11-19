/* PAP-2194 local real workerd transport regression. Only loopback fixtures, no live service or credentials. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {build}=require('esbuild');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
(async()=>{
 const gateway=(await build({entryPoints:[path.join(__dirname,'../src/staging-worker.mjs')],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022'})).outputFiles[0].text;
 // Use the installed workerd's supported local date; deployed config is unchanged.
 const bff=`export default {fetch(r){const p=new URL(r.url).pathname;if(p==='/piner-space/afterschool/login')return new Response('fixture login');if(r.redirect!=='manual')return new Response(null,{status:500});const c=r.headers.get('cookie')??'';if(!c.startsWith('__Host-PINO_AFTERSCHOOL='))return new Response(null,{status:401});if(c.endsWith('redirect'))return new Response(null,{status:302,headers:{location:'https://example.invalid/never-follow'}});if(c.endsWith('denied'))return new Response(null,{status:401});if(c.endsWith('unavailable'))return new Response(null,{status:503});if(!r.headers.get('cf-connecting-ip')||r.headers.get('sec-fetch-site')!=='same-origin')return new Response(null,{status:503});if(p.endsWith('/session'))return Response.json({data:{authenticated:true,expiresAt:'2099-01-01T00:00:00Z'}});if(p.endsWith('/students'))return Response.json({data:[{id:'fixture-only',displayName:'Synthetic Learner'}]});return new Response(null,{status:404});}}`;
 const options={host:'127.0.0.1',port:0,workers:[{name:'gateway-fixture',modules:true,compatibilityDate:'2026-10-26',script:gateway,serviceBindings:{AFTERSCHOOL_PIN_WORKER:'bff-fixture'}},{name:'bff-fixture',modules:true,compatibilityDate:'2026-10-26',script:bff}]};
 const m=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);
 let n=0;
 try{const fetch=(p,c,method='GET')=>m.dispatchFetch('http://127.0.0.1'+p,{method,redirect:'manual',headers:{'sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.10',...(c?{cookie:'__Host-PINO_AFTERSCHOOL='+c}:{})}});
 for(const [p,c,status,marker] of [['/','valid',200,/data-member-session="true"/],['/piner/house','valid',200,/Synthetic Learner/],['/login','valid',302,null],['/',null,302,null],['/','denied',302,null],['/','redirect',503,/Chưa thể kiểm tra phiên đăng nhập/],['/login','unavailable',503,/Chưa thể kiểm tra phiên đăng nhập/]]){const r=await fetch(p,c);assert.equal(r.status,status,p+' '+c);const t=await r.text();if(marker)assert.match(t,marker);if(status===302)assert.equal(new URL(r.headers.get('location')).pathname,p==='/login'?'/':'/login');if(status===503){assert.equal(r.headers.get('location'),null);assert.doesNotMatch(t,/data-member-session/);}n++;}
 const h=await fetch('/piner/house','valid','HEAD');assert.equal(h.status,200);assert.equal(await h.text(),'');n++;console.log('WORKERD_LOCAL_BINDING_PASS '+n+'/'+n);
 }finally{await m.dispose();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
