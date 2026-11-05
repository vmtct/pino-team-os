/** PAP-1014: source guard, never pixel parity or authenticated API acceptance. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import postcss from "postcss";
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const folders=["app/components/tos-ds","app/components/tos-vnext"];
const files=folders.flatMap(folder=>fs.readdirSync(folder).filter(x=>/\.(css|tsx|ts)$/.test(x)).map(x=>folder+"/"+x));
const definitions=new Set(),references=new Set(),errors=[];
let frames=0;
for(const file of files){const text=read(file);
 if(/(?:export default function|function) AppPhoneFrame\b/.test(text))frames++;
 if(file.endsWith(".css")){
  const ast=postcss.parse(text);
  ast.walkDecls(d=>{
   if(d.prop.startsWith("--tos-"))definitions.add(d.prop);
   for(const m of d.value.matchAll(/var\(\s*(--tos-[\w-]+)/g))references.add(m[1]);
   if(d.important)errors.push(file+": !important");
   if(!file.endsWith("/tokens.css")&&/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black)\b/i.test(d.value))errors.push(file+": literal color "+d.prop);
  });
  ast.walkRules(rule=>{if(/\[class\s*\*?=/.test(rule.selector))errors.push(file+": class-name selector")});
 }else if(file.endsWith(".tsx")){
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){if(ts.isJsxAttribute(node)&&node.name.getText(ast)==="style"&&file!=="app/components/tos-vnext/TosVNextHome.tsx")errors.push(file+": inline style");ts.forEachChild(node,visit)}visit(ast);
 }
}
for(const variable of references)if(!definitions.has(variable)&&variable!=="--tos-avatar-bg")errors.push("Undefined token "+variable);
assert.equal(frames,1,"One AppPhoneFrame implementation");
const tokens=read("app/components/tos-ds/tokens.css");
assert.ok(tokens.includes("@layer tos.reset, tos.apps, tos.components, tos.layout, tos.controls"));
assert.ok(!tokens.includes(":root"),"TOS tokens cannot leak into BO");
assert.ok(!/--tos-palette-|--tos-type-/.test(tokens));
assert.ok(read("app/components/tos-vnext/TosVNextHome.tsx").includes('<AppPhoneFrame app="home">'));
const access=read("lib/tos-vnext-active-access.ts");
assert.match(access,/if\(!options\.authenticated\|\|!options\.centerReady\)return false/,"TOS app launch requires authenticated Center context");
assert.match(access,/case "station":return options\.desktop/,"Trạm TOS stays desktop-only");
assert.match(access,/case "shift-lead":case "classroom":case "training":return true/,"All nonstation apps, including Trưởng Ca, open independently of ShiftAssignment");
assert.doesNotMatch(access,/scheduleReady|roleAssignments|assignmentActiveNow/,"Home navigation must not depend on Shift schedule or role");

assert.match(read("app/components/tos-vnext/shift.module.css"),/max-width:374px/);
assert.doesNotMatch(read("app/components/tos-vnext/TosVNextShift.tsx"),/workforceApi\.(checkIn|checkOut)|localStorage|sessionStorage|photoReceipt/);
assert.doesNotMatch(read("app/components/tos-vnext/TosVNextTraining.tsx"),/Phát triển kỹ năng/);
if(errors.length)throw new Error(errors.join("\n"));
console.log(JSON.stringify({ok:true,sourceContract:"DS_V4",frameImplementations:frames,tokenCount:definitions.size,files:files.length,visualParity:"NOT_PROVEN",coreFunctional:"NOT_PROVEN"},null,2));
