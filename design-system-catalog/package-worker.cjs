const fs=require("fs"),zlib=require("zlib"),path=require("path");
const root=path.join(__dirname,"dist");
const names=["index.html","main.js","catalog.css","authority/styles.css","authority/playground.css","authority/playground-v22.css","authority/playground-v23.css","authority/full-detail-v24.css","authority/full-detail-v25.css"];
const data=Object.fromEntries(names.map(name=>[name,zlib.gzipSync(fs.readFileSync(path.join(root,name)),{level:9}).toString("base64")]));
const code='const RESOURCE='+JSON.stringify(data)+';\n'+
 'addEventListener("fetch", event => event.respondWith((async()=>{'+
 'const path=new URL(event.request.url).pathname.replace(/^\\//,"")||"index.html";'+
 'if(event.request.method!=="GET"&&event.request.method!=="HEAD")return new Response("Method Not Allowed",{status:405,headers:{"allow":"GET, HEAD"}});'+
 'if(!Object.prototype.hasOwnProperty.call(RESOURCE,path))return new Response("Not Found",{status:404,headers:{"cache-control":"no-store"}});'+
 'const binary=Uint8Array.from(atob(RESOURCE[path]),c=>c.charCodeAt(0));'+
 'const stream=new Blob([binary]).stream().pipeThrough(new DecompressionStream("gzip"));const type=path.endsWith(".js")?"application/javascript; charset=utf-8":path.endsWith(".css")?"text/css; charset=utf-8":"text/html; charset=utf-8";'+
 'return new Response(event.request.method==="HEAD"?null:stream,{status:200,headers:{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex, nofollow"}});'+
 '})()));';
fs.writeFileSync(path.join(__dirname,"worker-script.txt"),code);
console.log(JSON.stringify({uncompressed:Object.fromEntries(names.map(n=>[n,fs.statSync(path.join(root,n)).size])),encoded:Object.fromEntries(names.map(n=>[n,data[n].length])),workerScriptBytes:Buffer.byteLength(code)}));
