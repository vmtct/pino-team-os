import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderV4,buttons} from "./test-support/v4-render";
import {unavailableOpsReadModel} from "./tos-ops-v4-view-model";
const props={centerName:"Test Center",profileLabel:"Test Staff",workDate:"2026-10-27",shiftTime:"08:00 — 12:00"};
test("PAP-942 V4 opening has preview/checklist but cannot confirm or fake opening",async()=>{
 const html=await renderV4("ReceptionV4Presentation",props);assert.match(html,/Ảnh setup không gian/);assert.match(html,/Checklist/);assert.match(html,/Chưa xác minh/);
 assert.match(buttons(html,"Mở Ca Tiếp Tân")[0],/disabled/);assert.match(html,/Xem quầy · Không xác nhận mở ca/);
 assert.doesNotMatch(html,/Ca Tiếp Tân đã mở|Vào lúc/);
});
test("PAP-942 V4 three tabs distinguish unavailable from confirmed empty",async()=>{
 for(const initialTab of ["overview","arrivals","pinoria"]){
  const html=await renderV4("ReceptionV4Presentation",{...props,initialReadOnly:true,initialTab});
  assert.match(html,/Điều hướng Tiếp Tân/);assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.doesNotMatch(html,/Linh|Chroma Sea|Region mẫu/);
  if(initialTab==="arrivals")assert.match(html,/Chưa tải được danh sách đón/);
 }
 const html=await renderV4("ReceptionV4Presentation",{...props,initialReadOnly:true,initialTab:"arrivals",model:{...unavailableOpsReadModel(),loaded:true}});assert.match(html,/Không có học viên phù hợp/);
});
test("PAP-942 Wish controls stay disabled with supplied records and no store can write",async()=>{
 const model={...unavailableOpsReadModel(),loaded:true,guests:[{id:"s",name:"Test",initials:"T",className:"Test",classTime:"08:00",room:"R",guardian:"G"}],wishes:{s:false}};
 const before=JSON.stringify(model),html=await renderV4("ReceptionV4Presentation",{...props,initialReadOnly:true,initialTab:"pinoria",model});assert.match(buttons(html,"Xử lý")[0],/disabled/);assert.equal(JSON.stringify(model),before);
 for(const name of ["ReceptionV4Presentation","ReceptionV4OpenShift"]){const source=readFileSync("app/components/tos-vnext/"+name+".tsx","utf8");assert.doesNotMatch(source,/useOpsDemo|useReceptionShiftDemo|ops-demo-store|localStorage|sessionStorage|fetch\(/)}
});
