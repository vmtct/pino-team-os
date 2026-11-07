import * as esbuild from "esbuild";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const stub={name:"fixture-no-outbound",setup(build){
 build.onResolve({filter:/^@\/app\/components\/tos-shell\/LogoutButton$/},()=>({path:"logout",namespace:"fixture"}));
 build.onResolve({filter:/^\.\/BoRegistrationHistory$/},args=>args.importer.replaceAll("\\","/").includes("/bo/components/registration/")?{path:"history",namespace:"fixture"}:undefined);
 build.onLoad({filter:/.*/,namespace:"fixture"},args=>({loader:"tsx",resolveDir:root,contents:args.path==="history"?'export function BoRegistrationHistory(){return <div role="status" className="v24-audit-empty">Fixture: history API disabled in isolated DS.</div>;}':'export function LogoutButton(){return null;}'}));
}};
await esbuild.build({entryPoints:[path.join(here,"catalog.tsx")],outfile:path.join(here,"dist","main.js"),bundle:true,minify:true,treeShaking:true,format:"iife",platform:"browser",target:"es2022",jsx:"automatic",alias:{"@":root},plugins:[stub],define:{"process.env.NODE_ENV":'"production"'},logLevel:"info",metafile:true});
console.log("DS built from "+root);
const fs=await import("node:fs");
const dest=path.join(here,"dist");
fs.mkdirSync(path.join(dest,"authority"),{recursive:true});
for(const file of ["styles.css","playground.css","playground-v22.css","playground-v23.css","full-detail-v24.css","full-detail-v25.css"]){
  fs.copyFileSync(path.join(root,"public","bo-authority-source",file),path.join(dest,"authority",file));
}
for(const file of ["index.html","catalog.css"]){
  fs.copyFileSync(path.join(here,file),path.join(dest,file));
}
console.log("DS authority CSS, HTML and catalog controls copied from canonical BO source.");
