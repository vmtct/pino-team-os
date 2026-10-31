#!/usr/bin/env node
/**
 * PAP-1014 runtime design system safety gate.
 * This gate is source-level. Playwright baseline parity and Core auth acceptance are additional gates.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const ds="app/components/tos-ds";
const old="app/components/tos-vnext";
const errors=[];
function check(x,msg){if(!x)errors.push(msg)}
for(const file of ["index.ts","types.ts","TosDesignSystem.tsx","components.module.css","tokens.css"]){
 check(fs.existsSync(path.join(root,ds,file)),"missing DS file "+file)
}
const src=read(ds+"/TosDesignSystem.tsx");
const token=read(ds+"/tokens.css");
const css=read(ds+"/components.module.css");
const adapter=read(old+"/TosVNextUI.tsx");
const legacy=read(old+"/tos-vnext.module.css");
const exported=read(ds+"/index.ts");
for(const component of ["AppFrame","AppHeader","AppBottomNav","AppCard","AppSectionHeading","AppSheet","AppToast","AppButton","AppField","AppStatusBadge","AppIconButton"]){
 check(new RegExp("\\b"+component+"\\b").test(exported),"missing canonical export "+component)
}
for(const t of ["--tos-text-body","--tos-hit-min","--tos-mobile-max","--tos-nav-height","--tos-color-station","--tos-color-classroom"]){
 check(token.includes(t+":"),"missing token "+t)
}
check(!css.includes("!important"),"DS must be free of !important");
check(!css.includes("[class*="),"DS may not target hashed CSS Module classes");
check(!legacy.includes("!important"),"VNext-specific style contains !important");
check(!legacy.includes("[class*="),"VNext-specific style contains hashed CSS selectors");
check(!adapter.includes("function TosVNext"),"old UI source still duplicates implementations");
check(adapter.includes('export * from "../tos-ds"'),"old UI must only re-export canonical DS");
check(src.includes('e.key==="Escape"')&&src.includes("document.body.style.overflow"),"modal keyboard/scroll mechanics missing");
const views=[
"TosVNextClassroom.tsx","TosVNextReception.tsx","TosVNextShiftLead.tsx","TosVNextStation.tsx","TosVNextTraining.tsx"
];
for(const view of views){
 const text=read(old+"/"+view);
 check(text.includes('from "../tos-ds"'),view+" does not import DS");
 check(!text.includes('from "./TosVNextUI"'),view+" still imports old module");
}
const entry=read("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx");
check(entry.includes('from "@/app/components/tos-ds"'),"integration frame does not import canonical DS");
check(!src.includes("fetch("),"DS component must remain presentation-only");
check(!src.includes("/api/"),"DS contains API path");
check(!src.includes("coreClient"),"DS references Core");
check(legacy.includes("/* Approved Home keeps"),"loss of legacy app-specific layouts");
const result={ok:errors.length===0,issues:errors,componentCount:11,consumerCount:views.length+1,baseline:"PAP-934 V8 frozen visual authority",source:"PAP-1014",runtimeCodeIsolated:true};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode=1;
