/* PAP-1684 / PAP-1606 · Epic PAP-1601 — HO S1 bespoke list heading parity. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PinoNavLocaleContext, LocalizedModuleTitle } from "./pino-nav-locale-context";

const specs: readonly (readonly [string,string,string,string,string,string])[] = [
 ["app/ho/system/audit/HoAccessAudit.tsx","audits","Access Audit","Audit","Nhật ký kiểm toán",'<small>Read only · Access events only</small>'],
 ["app/ho/pinoria/tv-policies/page.tsx","tvPolicies","Pinoria TV","Pinoria TV","Pinoria TV","Danh sách chính sách trình chiếu sẽ xuất hiện tại đây"],
];
for(const [file,moduleKey,sourceLabel,en,vi,unchanged] of specs){
 test("HO custom list VI/EN "+file,()=>{
  const src=readFileSync(resolve(file),"utf8");
  assert.ok(src.includes('<LocalizedModuleTitle label="'+sourceLabel+'" moduleKey="'+moduleKey+'" />'));
  assert.ok(src.includes('import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";'));
  assert.ok(src.includes(unchanged),"existing business/list content preserved");
  const node=createElement("h1",null,createElement(LocalizedModuleTitle,{label:sourceLabel,moduleKey}));
  for(const [lang,expected] of [["en",en],["vi",vi]] as const){
   const markup=renderToStaticMarkup(createElement(PinoNavLocaleContext.Provider,{value:{surface:"ho",language:lang}},node));
   assert.equal(markup,"<h1>"+expected+"</h1>");
  }
 });
}
