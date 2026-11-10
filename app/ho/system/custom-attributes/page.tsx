"use client";
/** PAP-1669 / PAP-1665 PLT-ATTR FSG2 — Founder Create and View reuse BoQuickView.
 * Stage FSG3 Table and FSG4 Full Detail are intentionally not implemented here.
 */
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { boApi } from "@/lib/bo-api";
import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";
import {
 attributeModule, optionsField, draft, asRecord, draftRecord, editDraft, validate,
 needsOptions, ENTITY_TYPES, VALUE_TYPES, VISIBILITY,
 type AttributeDefinition,type AttributeDraft,type CenterOption
} from "@/lib/ho-attribute-model";
import type { BoField } from "@/lib/bo-registration";

const endpoint="/api/ho/custom-attributes/definitions";
const editKeys=new Set(["displayName","attributeKey","entityType","valueType","scope","center","required","visibility","options"]);
const message=(status:number)=>status===409?"Mã thuộc tính đã tồn tại hoặc yêu cầu bị trùng."
 :status===422||status===400?"Dữ liệu thuộc tính chưa hợp lệ."
 :status===401||status===403?"Tài khoản không có quyền Founder trên HO."
 :status===503?"Dịch vụ Core đang không khả dụng. Vui lòng thử lại."
 :"Không thể lưu thuộc tính. Hãy thử lại.";
const isDefinition=(v:unknown):v is AttributeDefinition=>Boolean(v&&typeof v==="object"&&
 "id" in v && typeof v.id==="string"&&"displayName" in v&&"revision" in v);
async function definitionResponse(response:Response):Promise<unknown>{
 const body=await response.json() as {data?:unknown;error?:{code?:string}};
 if(!response.ok)throw new Error(message(response.status));
 if(!("data" in body))throw new Error("Core không trả về dữ liệu hợp lệ.");
 return body.data;
}
function CustomAttributesFsg2(){
 const menu=useContext(TddHostMenu);
 const launch=useRef<HTMLButtonElement>(null);
 const replayKey=useRef("");
 const [centers,setCenters]=useState<CenterOption[]>([]);
 const [value,setValue]=useState<AttributeDraft>(draft);
 const [open,setOpen]=useState<"create"|"view"|null>(null);
 const [selected,setSelected]=useState<AttributeDefinition|null>(null);
 const [count,setCount]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState("");
 const fetchList=useCallback(async():Promise<AttributeDefinition[]>=>{
  const response=await fetch(endpoint+"?limit=50&offset=0",{cache:"no-store"});
  const data=await definitionResponse(response);
  if(!data||typeof data!=="object"||!("items" in data)||
    !Array.isArray(data.items))throw new Error("Danh sách thuộc tính không hợp lệ.");
  return data.items.filter(isDefinition);
 },[]);
 useEffect(()=>{
  let active=true;
  void boApi.centers().then(rows=>{
   if(active)setCenters(rows.filter(c=>c.status==="active").map(c=>({id:c.id,label:c.displayName})));
  }).catch(()=>{if(active)setCenters([]);});
  void fetchList().then(rows=>{
   if(active){setCount(rows.length);setSelected(rows[0]??null);}
  }).catch(()=>{if(active)setStatus("Không tải được danh sách thuộc tính từ Core.");});
  return()=>{active=false;};
 },[fetchList]);
 const launchCreate=()=>{
  replayKey.current=crypto.randomUUID();
  setValue(draft());setError("");setOpen("create");
 };
 const close=()=>{setOpen(null);setError("");requestAnimationFrame(()=>launch.current?.focus());};
 const fields:BoField[]=[...attributeModule.fields,...(needsOptions(value.valueType)?[optionsField]:[])];
 const editorField=(f:BoField):BoField=>({
  ...f,readonly:false,type:f.key==="attributeKey"?"text":
   f.key==="center"?"select":f.type,
  options:f.key==="entityType"?[...ENTITY_TYPES]:
   f.key==="valueType"?[...VALUE_TYPES]:
   f.key==="scope"?["GLOBAL","CENTER"]:
   f.key==="center"?centers.map(c=>c.label):
   f.key==="visibility"?[...VISIBILITY]:undefined
 });
 const create=async()=>{
  const issue=validate(value,centers);
  if(issue){setError(issue);return;}
  if(busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch(endpoint,{method:"POST",cache:"no-store",headers:{
    "content-type":"application/json","idempotency-key":replayKey.current
   },body:JSON.stringify(value)});
   const created=await definitionResponse(response);
   if(!isDefinition(created))throw new Error("Core không trả về thuộc tính vừa tạo.");
   const read=await definitionResponse(await fetch(endpoint+"/"+encodeURIComponent(created.id),{cache:"no-store"}));
   if(!isDefinition(read)||read.id!==created.id||read.attributeKey!==value.attributeKey)
    throw new Error("Readback Core chưa khớp bản ghi vừa tạo.");
   const items=await fetchList();
   if(!items.some(item=>item.id===created.id))
    throw new Error("Bản ghi chưa xuất hiện trong danh sách Core.");
   setCount(items.length);setSelected(read);setStatus("Đã tạo bản nháp và xác minh Core readback.");
   setOpen("view");
  }catch(e){setError(e instanceof Error?e.message:"Không thể lưu thuộc tính.");}
  finally{setBusy(false);}
 };
 return <section id="list-screen" data-plt-attr-stage="fsg2-create-drawer">
  <div className="page-heading"><div className="page-heading-left">
   {menu("menu-btn")}<h1><LocalizedModuleTitle label="Custom Attributes" moduleKey="customAttributes"/></h1>
  </div><button ref={launch} type="button" className="primary-btn" onClick={launchCreate}>＋ Tạo thuộc tính</button></div>
  <div className="grid-card" style={{padding:24}}>
   <p className="settings-hint">Tạo định nghĩa thuộc tính · Founder-only. Danh sách đầy đủ sẽ được triển khai tại FSG3.</p>
   {status?<p role="status" className="settings-hint">{status}</p>:null}
   {count!==null?<p className="settings-hint">Số bản ghi trong trang Core hiện tại: {count}</p>:null}
   {selected?<button type="button" className="secondary-btn" onClick={()=>setOpen("view")}>
    Xem thuộc tính gần nhất · {selected.displayName}
   </button>:null}
  </div>
  {open==="create"?<BoQuickView module={attributeModule} record={null} onClose={close}
   create={{
    title:"Tạo thuộc tính",path:"System · Custom Attributes",draft:draftRecord(value,centers),
    fields,editable:f=>editKeys.has(f.key)&&(f.key!=="center"||value.scope==="CENTER")&&
     (f.key!=="options"||needsOptions(value.valueType)),
    editorField,onChange:(key,raw)=>{setValue(old=>editDraft(old,key,raw,centers));setError("");},
    onCreate:create,busy,error
   }}/>:null}
  {open==="view"&&selected?<BoQuickView module={attributeModule}
   record={asRecord(selected,centers)} hideDetailAction onClose={close}/>:null}
 </section>;
}
export default function HoCustomAttributesPage(){
 return <HoWorkspace module="customAttributes" content={<CustomAttributesFsg2/>}/>;
}
