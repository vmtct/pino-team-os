// PAP-1943 / PNR-APP-HUB — independent Cloudflare Worker, no member data/auth API.
import {parseRoute,getShellAdapter,assertFailClosed} from "./adapter.mjs";
import {renderHtml} from "./view.mjs";
import {CSS} from "./styles.mjs";
import {CLIENT} from "./client.mjs";
const VERSION="PAP-1943-F1F2-preview";
const HEADERS={
 "Content-Security-Policy":"default-src 'none'; img-src 'self' https://assets.pinohouse.art data:; style-src 'self'; script-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
 "Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
 "X-Frame-Options":"DENY","X-Piner-Shell":VERSION
};
function out(body,status,kind,method,more={}){
 const headers=new Headers(HEADERS);headers.set("Content-Type",kind);
 for(const [k,v] of Object.entries(more))headers.set(k,v);
 return new Response(method==="HEAD"?null:body,{status,headers});
}
export async function handleRequest(request,env={}){
 const u=new URL(request.url),method=request.method;
 if(method!=="GET"&&method!=="HEAD")return out("Method Not Allowed",405,"text/plain; charset=utf-8",method,{"Allow":"GET, HEAD"});
 if(u.pathname==="/piner-shell.css")return out(CSS,200,"text/css; charset=utf-8",method);
 if(u.pathname==="/piner-shell.js")return out(CLIENT,200,"application/javascript; charset=utf-8",method);
 const route=parseRoute(u.pathname);
 if(route)return out(renderHtml(route,assertFailClosed(getShellAdapter())),200,"text/html; charset=utf-8",method);
 // Preserve the same public R2 bucket object URLs when routing app.pinohouse.art through a Worker.
 // No list/write and no private media access; do not detach the existing R2 custom domain.
 const key=decodeURIComponent(u.pathname.slice(1));
 if(!key||key.startsWith(".")||key.includes("..")||key.includes("\\")||key.startsWith("/"))return out("Not Found",404,"text/plain; charset=utf-8",method);
 if(!env.PINER_BRAND_R2)return out("Brand assets unavailable",503,"text/plain; charset=utf-8",method);
 const obj=await env.PINER_BRAND_R2.get(key);
 if(!obj)return out("Not Found",404,"text/plain; charset=utf-8",method);
 const headers=new Headers({"X-Content-Type-Options":"nosniff","X-Piner-Shell":VERSION});
 obj.writeHttpMetadata(headers);headers.set("ETag",obj.httpEtag);
 headers.set("Cache-Control","public, max-age=3600");
 return new Response(method==="HEAD"?null:obj.body,{headers,status:200});
}
export default {fetch:handleRequest};
