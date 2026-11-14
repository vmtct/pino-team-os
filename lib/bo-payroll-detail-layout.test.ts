import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {BoPayrollPeriodInformation,payrollPeriodInfoFields} from "@/app/bo/components/registration/BoPayrollPeriodInformation";

const fixture = {
 id: "01a171ed-eb78-7941-b1de-dd4c020457b7",
 name: "Lương tháng 10 - Staging Delivery Syllabus",
 startDate: "2026-10-01",
 endDate: "2026-10-31",
 centerName: "Staging Delivery Syllabus",
};

test("PAP-1160 Payroll Detail uses ten compact canonical BO fields, not legacy 72px property rows",()=>{
 const fields=payrollPeriodInfoFields(fixture,null);
 assert.deepEqual(fields.map(f=>f.label),["ID","Tên kỳ","Bắt đầu","Kết thúc","Trạng thái","Center","Created Time","Created By","Last Modified Time","Last Modified By"]);
 assert.equal(fields[2].value,"01/10/2026");
 assert.equal(fields[3].value,"31/10/2026");
 const html=renderToStaticMarkup(createElement(BoPayrollPeriodInformation,{fields}));
 assert.match(html,/class="v24-prop-grid"/);
 assert.equal((html.match(/class="v24-prop-item"/g)||[]).length,10);
 assert.equal((html.match(/class="v24-prop-value readonly"/g)||[]).length,10);
 assert.doesNotMatch(html,/class="property-row"/);
 assert.doesNotMatch(html,/PTE đã tính được lương/);
 assert.doesNotMatch(html,/Tổng Dự Kiến|Tổng Quyết Toán/);
 assert.match(html,/01a171ed-eb78-7941-b1de-dd4c020457b7/);
});

test("PAP-1160 fallback metadata stays read-only and avoids fake dates",()=>{
 const fields=payrollPeriodInfoFields({...fixture,startDate:"",endDate:"invalid",centerName:""},null);
 assert.equal(fields[2].value,"—");
 assert.equal(fields[3].value,"invalid");
 assert.equal(fields[5].value,"—");
});

test("PAP-1959 period detail displays only authorized verified actors and genuine times",()=>{
 const period={id:fixture.id,centerId:"center",name:fixture.name,startDate:fixture.startDate,endDate:fixture.endDate,status:"ACTIVE" as const,version:1,dateLocked:false,createdAt:"2026-10-01T01:00:00Z",createdBy:"Synthetic Creator",updatedAt:"2026-10-02T02:00:00Z",updatedBy:"Synthetic Editor"};
 assert.deepEqual(payrollPeriodInfoFields(fixture,period).slice(-4).map(f=>f.value),["01/10/2026 · 08:00","Synthetic Creator","02/10/2026 · 09:00","Synthetic Editor"]);
 assert.deepEqual(payrollPeriodInfoFields(fixture,null).slice(-4).map(f=>f.value),Array(4).fill("—"));
});
