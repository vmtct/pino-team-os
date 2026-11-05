/** Node-only structural render: no browser or business transport. */
import {build} from "esbuild";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import {after} from "node:test";
import {createElement,type ComponentType} from "react";
import {renderToStaticMarkup} from "react-dom/server";
const directory=mkdtempSync(join(tmpdir(),"pap938-v4-"));
after(()=>rmSync(directory,{recursive:true,force:true}));
const renderers=new Map<string,ComponentType<any>>();
export async function renderV4(name:string,props:Record<string,unknown>){
 let renderer=renderers.get(name);
 if(!renderer){
  const output=join(directory,name+".cjs");
  await build({entryPoints:["app/components/tos-vnext/"+name+".tsx"],outfile:output,platform:"node",format:"cjs",bundle:true,packages:"external",jsx:"automatic",logLevel:"silent",plugins:[{name:"css-module-structural-stub",setup(b){
   b.onLoad({filter:/\.module\.css$/},a=>({contents:"export default "+JSON.stringify(Object.fromEntries([...readFileSync(a.path,"utf8").matchAll(/\.([A-Za-z_][\w-]*)/g)].map(m=>[m[1],m[1]]))),loader:"js"}));
   b.onLoad({filter:/\.css$/},()=>({contents:"",loader:"js"}));
  }}]});
  const require=createRequire(join(process.cwd(),"package.json")),Module=require("node:module");
  const entry=new Module(output);entry.filename=output;entry.paths=Module._nodeModulePaths(process.cwd());entry._compile(readFileSync(output,"utf8"),output);
  renderer=entry.exports.default??entry.exports.TosVNextStation;renderers.set(name,renderer!);
 }
 return renderToStaticMarkup(createElement(renderer!,props));
}
export function buttons(html:string,label:string){return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m=>m[0]).filter(tag=>tag.replace(/<[^>]*>/g,"").includes(label))}
