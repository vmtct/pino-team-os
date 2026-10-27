/** Node SSR only; no browser, server, cookies, Core or business writes. */
import {build} from "esbuild";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import {after} from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {ClassroomV4InitialView,ClassroomV4ViewModel} from "../tos-classroom-v4-view-model";
const directory=mkdtempSync(join(tmpdir(),"pap945-ssr-"));
const output=join(directory,"renderer.cjs");
after(()=>rmSync(directory,{recursive:true,force:true}));
let renderer:typeof import("../../app/components/tos-vnext/ClassroomV4Presentation").default|undefined;
export async function renderClassroom(model:ClassroomV4ViewModel,initialView?:ClassroomV4InitialView){
 if(!renderer){
  await build({entryPoints:["app/components/tos-vnext/ClassroomV4Presentation.tsx"],outfile:output,platform:"node",format:"cjs",bundle:true,packages:"external",jsx:"automatic",logLevel:"silent",plugins:[{name:"isolated-css-module-stub",setup(builder){
   builder.onLoad({filter:/\.module\.css$/},args=>{const text=readFileSync(args.path,"utf8");const classes=Object.fromEntries([...text.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(m=>[m[1],m[1]]));return {contents:"export default "+JSON.stringify(classes),loader:"js"}});
   builder.onLoad({filter:/\.css$/},()=>({contents:"",loader:"js"}));
  }}]});
  // Resolve React from the candidate, not from the temporary directory.
  const require=createRequire(join(process.cwd(),"package.json"));
  const Module=require("node:module");
  const compiled=readFileSync(output,"utf8");
  const entry=new Module(output);entry.filename=output;entry.paths=Module._nodeModulePaths(process.cwd());entry._compile(compiled,output);
  renderer=entry.exports.default;
 }
 return renderToStaticMarkup(createElement(renderer!,{model,initialView}));
}
export function buttonTags(html:string,label:string){return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m=>m[0]).filter(tag=>tag.replace(/<[^>]*>/g,"").includes(label))}
