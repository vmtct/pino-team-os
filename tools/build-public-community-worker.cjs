"use strict";
// PAP-1800 · Authoritative i5 source → SAFE generated public preview Worker.
// Never imports real member/guardian records. Private posts are rejected BEFORE serialization.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm"),{createRequire}=require("node:module");
const root=path.resolve(__dirname,"..");
const target=process.env.PINER_PUBLIC_OUTPUT||path.join(root,".piner-public-demo.worker.mjs");
const deps=process.env.PINER_DEP_ROOT||path.join(root,"node_modules");
const localRequire=createRequire(path.join(deps,"..","package.json"));
const ts=localRequire("typescript");
const React=localRequire("react"),{renderToStaticMarkup}=localRequire("react-dom/server");
function readModule(file,jsx=false){
 const full=path.join(root,file);
 const output=ts.transpileModule(fs.readFileSync(full,"utf8"),{fileName:full,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:jsx?ts.JsxEmit.ReactJSX:undefined
 }}).outputText;
 const module={exports:{}};
 new Function("module","exports","require",output)(module,module.exports,localRequire);
 return module.exports;
}
const media=readModule("app/piner/media.ts");
const allowlist=readModule("app/piner/publicApproved.ts");
const {MediaArtwork}=readModule("app/piner/MediaArtwork.tsx",true);
const approved=new Set(allowlist.PUBLIC_FIXTURE_IDS);
if(approved.size!==6)throw Error("PUBLIC_FIXTURE_APPROVED_COUNT_DRIFT");
const aliases={an:"Piner An",binh:"Piner Bình",mai:"Piner Mai"};
function toPublic(post){
 const visuals=media.PHOTO_CAROUSELS[post.id]||[post.visual];
 return {
  id:post.id,type:post.type,app:post.app,title:post.title,caption:post.caption,date:post.date,alias:aliases[post.ownerId],
  comments:post.comments.map(c=>({author:c.author,body:c.body})),
  svgs:visuals.map((visual,i)=>renderToStaticMarkup(React.createElement(MediaArtwork,{post:{...post,id:post.id+"-public-"+i,visual}})))
 };
}
const all=media.POSTS;
for(const id of approved){const p=all.find(p=>p.id===id);if(!p||p.visibility!=="community")throw Error("PUBLIC_ALLOWLIST_CONSENT_MISMATCH "+id)}
const posts=all.filter(p=>approved.has(p.id)&&p.visibility==="community").map(toPublic);
const denied=all.filter(p=>!approved.has(p.id));
if(posts.length!==approved.size||denied.length!==4)throw Error("PUBLIC_FILTER_COUNT_DRIFT");
const videoDir=path.join(root,"public","piner","media");
const videos={
 "art-demo":fs.readFileSync(path.join(videoDir,"art-demo.mp4")).toString("base64"),
 "piano-demo":fs.readFileSync(path.join(videoDir,"piano-demo.mp4")).toString("base64")
};
const template=fs.readFileSync(path.join(__dirname,"piner-public-community-worker.template.mjs"),"utf8");
const keys=["/*__PUBLIC_POSTS__*/","/*__PUBLIC_VIDEOS__*/"];
for(const key of keys)if(template.split(key).length!==2)throw Error("WORKER_PLACEHOLDER_DRIFT "+key);
const code=template.replace(keys[0],JSON.stringify(posts)).replace(keys[1],JSON.stringify(videos));
for(const p of denied){
 if(code.includes(p.title)||code.includes(p.caption))throw Error("PRIVATE_TEXT_EMBEDDED_IN_WORKER "+p.id);
}
fs.writeFileSync(target,code,"utf8");
const info={source:path.relative(process.cwd(),root),target,sha256:crypto.createHash("sha256").update(code).digest("hex"),
 bytes:Buffer.byteLength(code),public_ids:posts.map(p=>p.id),denied_ids:denied.map(p=>p.id),
 videos:Object.fromEntries(Object.entries(videos).map(([name,b64])=>[name,Buffer.byteLength(b64,"base64")]))};
fs.writeFileSync(target+".receipt.json",JSON.stringify(info,null,2));
console.log("PAP1800_PUBLIC_WORKER_BUILD "+JSON.stringify(info));
