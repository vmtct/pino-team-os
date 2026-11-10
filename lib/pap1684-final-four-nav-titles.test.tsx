/* PAP-1684/PAP-1605: selected BO nav-first list headings for 4 remaining routes, Epic PAP-1601. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PinoNavLocaleContext,LocalizedModuleTitle} from "./pino-nav-locale-context";
const cases: readonly (readonly [string,string,string,string,string])[] = [
 ["app/bo/pinoria-tv-operator/page.tsx","pinoria-tv-operator","TV Operations","Vận hành TV","Điều khiển TV"],
 ["app/bo/pinoria-ward/learners/WardLearnerManager.tsx","pinoria-ward/learners","Loadouts","Trang bị","Learner Wardrobe"],
 ["app/bo/pinoria-wish/WishBoView.tsx","pinoria-wish","Wish","Điều ước","Wish / Hạt Năng Lượng"],
 ["app/bo/workforce/WorkforcePlanningView.tsx","workforce","Schedule & Time","Lịch và thời gian","Lịch ca tuần"],
];
for(const [file,key,label,vi,old] of cases){
 test("BO final nav-owned list title "+file,()=>{
 const src=readFileSync(resolve(file),"utf8");
 assert.ok(src.includes('import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";'));
 assert.ok(src.includes('<h1><LocalizedModuleTitle label="'+label+'" moduleKey="'+key+'" /></h1>'));
 assert.ok(!src.includes("<h1>"+old+"</h1>"));
 const h1=createElement("h1",null,createElement(LocalizedModuleTitle,{label,moduleKey:key}));
 for(const [language,expected] of [["en",label],["vi",vi]] as const){
  const out=renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider,{value:{surface:"bo",language}},h1));
  assert.equal(out,"<h1>"+expected.replaceAll("&","&amp;")+"</h1>");
 }
 });
}
