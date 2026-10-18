import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const root=new URL(".",import.meta.url);
for(const file of ["BoParentsView.tsx","page.tsx","../../..//lib/bo-parent-guardian.ts"]){
  const url=new URL(file,root);
  const source=fs.readFileSync(url,"utf8");
  const result=ts.transpileModule(source,{reportDiagnostics:true,fileName:file,compilerOptions:{
    jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
  }});
  const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,file+": "+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join("; "));
  console.log("PASS TS/TSX syntax",file,source.length,"chars");
}
const page=fs.readFileSync(new URL("BoParentsView.tsx",root),"utf8");
assert.ok(page.includes("BoDataGridSidePeek")&&page.includes("<BoDataGrid"));
assert.ok(page.includes('{"overview"')||page.includes('overview:"Tổng quan"'));
assert.ok(page.includes("parentApi.link(")&&page.includes("parentApi.unlink("));
assert.ok(!page.includes("effectiveFrom")&&!page.includes("effectiveUntil"));
const api=fs.readFileSync(new URL("../../..//lib/bo-parent-guardian.ts",root),"utf8");
assert.ok(api.includes("cache:\"no-store\""));
assert.ok(api.includes("idempotency-key"));
console.log("PASS native grid/drawer, no history controls, command types, no-store");
