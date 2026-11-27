// PAP-2192 M1 static export only; no network or production actions.
import {build} from "esbuild";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
const root=process.cwd(), output=resolve(root,".next/pap2192-review");
await mkdir(output,{recursive:true});
const nav=`import React from 'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`;
await build({absWorkingDir:root,entryPoints:["scripts/fixtures/pap2192-role-lifecycle-entry.tsx"],outfile:resolve(output,"fixture.js"),bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"fixture-nav",setup(b){b.onResolve({filter:/^next\/(link|navigation)$/},()=>({path:"nav",namespace:"fixture"}));b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:nav,loader:"jsx",resolveDir:root}));}}]});
await writeFile(resolve(output,"index.html"),'<!doctype html><html lang="vi" data-surface="ho" data-bo-ui-authority="v25"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./fixture.css"></head><body><div id="root"></div><script type="module" src="./fixture.js"></script></body></html>');
console.log("STATIC_SYNTHETIC_EXPORT_READY");
