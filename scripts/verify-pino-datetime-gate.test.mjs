/** PAP-1895 — required CI negative controls for source-level PINO DateTime contract. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditPinoDatetime } from "./verify-pino-datetime-gate.mjs";
function fixture(content, surface="bo"){
  const root=mkdtempSync(join(tmpdir(),"pap1895-gate-"));
  const dir=join(root,"app",surface);mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,"fake-schema.tsx"),content);
  return {root,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
const check=(src,surface)=>{
  const f=fixture(src,surface);
  try{return auditPinoDatetime(f.root,{requireCanon:false,legacyText:{},legacyLocale:[]});}
  finally{f.cleanup();}
};
test("PAP-1895 positive typed timestamp can render on BO, HO, TOS",()=>{
  const src='export const fields=[{ key: "assignedAt", label: "Ngày giao", type: "datetime" }]';
  for(const surface of ["bo","ho","tos-v4","staff","classroom"])
    assert.equal(check(src,surface).passed,true,surface);
});
test("PAP-1895 hard-fail new raw UTC/text/date field or technical field label",()=>{
  assert.match(check('{ key: "assignedAt", label: "Ngày giao", type: "text" }',"bo").errors.join(" "),/must use datetime/);
  assert.match(check('{ key: "cancelledAt", label: "Ngày hủy (UTC)", type: "datetime" }',"tos-v4").errors.join(" "),/UTC label forbidden/);
  assert.match(check('{ key: "createdAt", label: "Ngày tạo", type: "date" }',"ho").errors.join(" "),/must use datetime/);
});
test("PAP-1895 hard-fail newly added browser-locale-dependent operator timestamp",()=>{
  const src='export const view = <small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>';
  assert.match(check(src,"bo").errors.join(" "),/unzoned/);
  const approved='export const view = <small>{new Date(item.createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</small>';
  assert.equal(check(approved,"ho").passed,true);
});
test("PAP-1895 existing debt is NOT a new-feature exemption; stale entries fail",()=>{
  assert.equal(check('{ key: "assignedAt", type: "text" }',"bo").passed,false);
  const f=fixture('export const fields=[{ key: "assignedAt", type: "datetime" }]');
  try{
    const result=auditPinoDatetime(f.root,{requireCanon:false,legacyText:{"app/bo/fake-schema.tsx":["assignedAt"]},legacyLocale:[]});
    assert.match(result.errors.join(" "),/stale legacy exception/);
  }finally{f.cleanup();}
});
