"use client";
import { BusinessDataGrid, type BusinessFormProvider, type BusinessFormValue, type SlotLoaders } from "@/app/components/workspace-renderer/Slots";
import { currentAtlasScenario } from "./schema";
let values: Readonly<Record<string,BusinessFormValue>> = {label:"Demo form",quantity:1,day:"2026-10-30",notes:"Chỉ lưu mô phỏng trong RAM"};
export const resetDemoForm=()=>{ values={label:"Demo form",quantity:1,day:"2026-10-30",notes:"Chỉ lưu mô phỏng trong RAM"}; };
export const demoForm: BusinessFormProvider = {
 surface:"HO",moduleKey:"tddReference",slotId:"form",sourceAdapter:"demo.form",
 load:async()=>({status:"authorized",fields:[{key:"label",label:"Tên mô phỏng",type:"text",required:true},{key:"quantity",label:"Số lượng mô phỏng",type:"number",required:true},{key:"day",label:"Ngày mô phỏng",type:"date"},{key:"notes",label:"Ghi chú mô phỏng",type:"textarea"}],values}),
 submit:async(_request,next)=>{const scenario=currentAtlasScenario();if(scenario==="invalid")return {status:"invalid",fields:["quantity"]};if(scenario==="conflict")throw Error("DEMO conflict; no write");if(!next.label||typeof next.quantity!=="number"||next.quantity<0)return {status:"invalid",fields:["quantity"]};values={...next};return {status:"saved",message:"Mô phỏng thành công; chỉ RAM, không backend"};},
};
export const demoLoaders: SlotLoaders = {
 "demo.relations":async()=> <BusinessDataGrid caption="Bảng quan hệ DEMO — không có dữ liệu thật" rows={[{id:"demo-a",name:"Demo A"},{id:"demo-b",name:"Demo B"}]} rowKey={row=>row.id} columns={[{key:"name",header:"Tên mô phỏng",render:row=>row.name}]} />,
 "demo.timeline":async()=> <section className="v24-prop-section"><h3>Timeline mô phỏng</h3><p>30/10/2026 · Demo Actor · chỉ RAM</p></section>,
 "demo.metrics":async(_slot,record)=> <section className="v24-prop-section"><h3>Chỉ số mô phỏng</h3><p>Số lượng: {String(record.quantity)} · VND: {String(record.amount)} · Công thức: {String(record.computed)}</p></section>,
 "demo.media":async()=> <section className="v24-prop-section"><h3>Media mô phỏng</h3><p>Không tải ảnh hoặc file từ mạng. Upload/preview file chờ primitive được duyệt.</p></section>,
 "demo.audit":async()=> <section className="v24-prop-section"><h3>Quyền mô phỏng</h3><p>Demo Actor · dữ liệu giả lập đã che · không đọc audit thật hoặc cấp quyền.</p></section>,
};
