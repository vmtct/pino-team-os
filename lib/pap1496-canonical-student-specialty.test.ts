import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { BoFullDetail } from "../app/bo/components/registration/BoFullDetail";

const detailSource = readFileSync(new URL("../app/bo/components/registration/BoFullDetail.tsx",import.meta.url),"utf8");
const runtimeSource = readFileSync(new URL("../app/bo/components/registration/BoRuntimeBoundary.tsx",import.meta.url),"utf8");
const hostSource = readFileSync(new URL("../app/bo/architecture/bo-staging-route-policy.ts",import.meta.url),"utf8");

const module = {label:"Students",group:"SCHOOL",fields:[{key:"name",label:"Học viên",icon:"Aa",type:"text"}]};
const record = {id:"student-record",name:"Học viên A"};
const options = {module:module as never,moduleKey:"students",record:record as never,
  onBack:()=>{},mobileMenu:null};

test("PAP-1496: canonical BO Student Full Detail owns Specialty business tab before History",()=>{
  const view=html(h(BoFullDetail,{...options,enableStudentSubscriptions:true}));
  assert.match(view,/>Chuyên đề</);
  const sub=view.indexOf("Subscription"),specialty=view.indexOf("Chuyên đề"),history=view.indexOf("Lịch Sử");
  assert.ok(sub>=0 && specialty>sub && history>specialty);
  assert.match(view,/v24-prop-grid/);
});

test("PAP-1496: Specialty in canonical Student detail remains read-only until Core grant reader",()=>{
  const view=html(h(BoFullDetail,{...options,enableStudentSubscriptions:true,initialTab:"Chuyên đề"}));
  assert.match(view,/Đang tải Chuyên đề/);
  assert.doesNotMatch(view,/Mở khóa Chuyên Đề|Đã hoàn thành|Cấp quyền thành công/);
  assert.match(detailSource,/BoStudentSpecialtyTab items=\{undefined\} currentCenterLocalDate="" readOnly/);
  assert.match(detailSource,/lazy\(async \(\) => \{/);
  assert.doesNotMatch(detailSource,/student-specialty-grants|specialty\/purchases|fetch\(/);
});

test("PAP-1496: no extra Specialty tab on unrelated domains or unadmitted legacy shell",()=>{
  const other=html(h(BoFullDetail,{...options,moduleKey:"classes",enableStudentSubscriptions:false}));
  assert.doesNotMatch(other,/>Chuyên đề</);
  const legacy=html(h(BoFullDetail,{...options,enableStudentSubscriptions:false}));
  assert.doesNotMatch(legacy,/>Chuyên đề</);
  assert.match(runtimeSource,/boCenterModuleScope\(moduleKey\) === "CENTER"/);
  assert.match(runtimeSource,/return <CenterReadWorkspace/);
  assert.doesNotMatch(hostSource,/"\/bo\/learners"/);
});
