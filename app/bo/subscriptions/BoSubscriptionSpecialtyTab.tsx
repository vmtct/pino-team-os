"use client";
/**
 * PAP-1496 / PAP-1491 SPEC-UNLOCK.
 * Subscription × Specialty owns all commands; catalog previews never write.
 * The shared PINO BO DrawerFrame / DetailFrame are retained as renderer owners.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {boApi,BoApiError} from "@/lib/bo-api";
import type {BoSubscriptionSpecialtyRead,BoSubscriptionSpecialtyCatalogItem,BoSubscriptionSpecialtyGrant} from "@/lib/bo-subscription-specialty-model";
import type {BoModule,BoRecord} from "@/lib/bo-registration";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import styles from "./subscription-specialty.module.css";

type Load={state:"loading"}|{state:"error";error:string}|{state:"ready";data:BoSubscriptionSpecialtyRead};
type Command={
 kind:"grant"|"completion";key:string;subscriptionId:string;centerId:string;
 grant?:{specialtyId:string;effectiveFrom:string;expectedVersion:0};
 completion?:{grantId:string;completed:boolean;expectedVersion:number};
};
const previewModule:BoModule={label:"Chuyên đề",group:"Học tập",fields:[
 {key:"name",label:"Tên chuyên đề",type:"text",icon:"◇",w:2,readonly:true},
 {key:"id",label:"Mã chuyên đề",type:"id",icon:"#",w:2,readonly:true},
 {key:"pathProgramId",label:"Lộ trình",type:"id",icon:"↗",w:2,readonly:true},
 {key:"status",label:"Trạng thái",type:"text",icon:"●",w:1,readonly:true},
 {key:"createdAt",label:"Ngày tạo",type:"datetime",icon:"◷",w:1,readonly:true},
 {key:"createdBy",label:"Người tạo",type:"text",icon:"♙",w:1,readonly:true},
 {key:"updatedAt",label:"Cập nhật lúc",type:"datetime",icon:"◷",w:1,readonly:true},
 {key:"updatedBy",label:"Người cập nhật",type:"text",icon:"♙",w:1,readonly:true},
]};
const localDate=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const vnTime=(value:string|null|undefined)=>{
 if(!value)return "—";
 const parsed=new Date(value);
 return Number.isFinite(parsed.getTime())
  ?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(parsed):"—";
};
const message=(error:unknown)=>error instanceof BoApiError
 ?`${error.message}${error.requestId?` · ${error.requestId}`:""}`
 :error instanceof Error?error.message:"Không thể tải dữ liệu Chuyên đề.";
function accessible(data:BoSubscriptionSpecialtyRead,today:string){
 const sub=data.subject;
 return sub.lifecycle==="ACTIVE"&&Boolean(sub.serviceStartsOn)&&
  sub.serviceStartsOn!<=today&&(!sub.contractualEndsOn||sub.contractualEndsOn>=today);
}
function previewRecord(item:BoSubscriptionSpecialtyCatalogItem):BoRecord{
 // Read projection does not include publisher audit or a legal name. Never invent.
 return {id:item.id,name:item.name,pathProgramId:item.pathProgramId,status:"ACTIVE",
  createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
}
export function BoSubscriptionSpecialtyTab({subscriptionId,centerId,centerReady}:{
 subscriptionId:string;centerId:string;centerReady:boolean;
}){
 const [load,setLoad]=useState<Load>({state:"loading"});
 const [revision,setRevision]=useState(0);
 const [choice,setChoice]=useState("");
 const [effectiveFrom,setEffectiveFrom]=useState(localDate());
 const [busy,setBusy]=useState(false);
 const [pendingCommand,setPendingCommand]=useState<Command|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [notice,setNotice]=useState<string|null>(null);
 const [preview,setPreview]=useState<BoSubscriptionSpecialtyCatalogItem|null>(null);
 const [fullPreview,setFullPreview]=useState(false);

 const nextRequest=useRef(0);
 const previewReturn=useRef<HTMLButtonElement|null>(null);
 const fullRef=useRef<HTMLDivElement|null>(null);
 const today=localDate();
 const refresh=useCallback(async()=>{
  if(!centerReady||!centerId){setLoad({state:"error",error:"Hãy chọn Center có quyền để xem Subscription."});return;}
  const token=++nextRequest.current;
  setLoad({state:"loading"});
  try{
   const data=await boApi.subscriptionSpecialties(subscriptionId,centerId);
   if(token!==nextRequest.current)return;
   if(data.subject.id!==subscriptionId||data.subject.centerId!==centerId)
    throw new Error("Core trả về Subscription khác phạm vi Center được chọn.");
   setLoad({state:"ready",data});
  }catch(cause){
   if(token!==nextRequest.current)return;
   setLoad({state:"error",error:message(cause)});
  }
 },[subscriptionId,centerId,centerReady]);
 useEffect(()=>{
  const timer=window.setTimeout(()=>{void refresh();},0);
  return()=>window.clearTimeout(timer);
 },[refresh,revision]);
 const data=load.state==="ready"?load.data:null;
 const catalog=useMemo(()=>data?.catalog??[],[data]);
 const byId=useMemo(()=>new Map(catalog.map(item=>[item.id,item])),[catalog]);
 const canAct=Boolean(centerReady&&data&&data.subject.id===subscriptionId&&data.subject.centerId===centerId&&accessible(data,today));
 const chosen=catalog.find(item=>item.id===choice)??null;
 const chosenEligible=Boolean(chosen?.eligibleForNewGrant&&!chosen?.alreadyGranted);
 const run=async(command:Command)=>{
  if(busy||!centerReady||command.centerId!==centerId||command.subscriptionId!==subscriptionId)return;
  if(pendingCommand&&pendingCommand.key!==command.key)return;
  setPendingCommand(command);setBusy(true);setError(null);setNotice(null);
  try{
   if(command.kind==="grant"){
    if(!command.grant)throw new Error("Thiếu dữ liệu cấp chuyên đề.");
    await boApi.createSubscriptionSpecialtyGrant(subscriptionId,centerId,command.grant,command.key);
   }else{
    if(!command.completion)throw new Error("Thiếu dữ liệu hoàn thành.");
    await boApi.updateSubscriptionSpecialtyCompletion(subscriptionId,command.completion.grantId,centerId,
      {completed:command.completion.completed,expectedVersion:command.completion.expectedVersion},command.key);
   }
   setPendingCommand(null);
   setNotice(command.kind==="grant"?"Đã thêm Chuyên đề theo Subscription.":"Đã lưu trạng thái Hoàn thành.");
   setRevision(x=>x+1);
  }catch(cause){
   setError(message(cause));
   // A definitive Core rejection never leaves a replayable stale intent.
   if(cause instanceof BoApiError&&cause.status>=400&&cause.status<500){
    setPendingCommand(null);
    if(cause.status===409)setRevision(x=>x+1);
   }
  }finally{setBusy(false);}
 };
 const create=()=>{
  if(!canAct||!chosenEligible||!chosen||busy||pendingCommand||effectiveFrom<today)return;
  void run({kind:"grant",key:crypto.randomUUID(),subscriptionId,centerId,
   grant:{specialtyId:chosen.id,effectiveFrom,expectedVersion:0}});
 };
 const toggle=(grant:BoSubscriptionSpecialtyGrant)=>{
  if(!canAct||busy||pendingCommand||grant.effectiveFrom>today)return;
  void run({kind:"completion",key:crypto.randomUUID(),subscriptionId,centerId,
   completion:{grantId:grant.id,completed:!grant.completed,expectedVersion:grant.version}});
 };
 const showPreview=(item:BoSubscriptionSpecialtyCatalogItem,origin:HTMLButtonElement)=>{
  previewReturn.current=origin;setPreview(item);setFullPreview(false);
 };
 const closePreview=()=>{setPreview(null);setFullPreview(false);
  requestAnimationFrame(()=>previewReturn.current?.focus());};
 useEffect(()=>{
  if(!preview)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();
   if(fullPreview)setFullPreview(false);
   else{setPreview(null);setFullPreview(false);requestAnimationFrame(()=>previewReturn.current?.focus());}
  }};
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[preview,fullPreview]);
 return <section aria-label="Chuyên đề theo Subscription" data-pap1496-subscription={subscriptionId}
 className={styles.root}>
  <div className={styles.heading}>
   <div><h2>Chuyên đề</h2><p>Gắn với Subscription này · Không kế thừa giữa các Subscription</p></div>
   <button type="button" className="secondary-btn" disabled={!centerReady||busy}
    onClick={()=>{setPendingCommand(null);setRevision(x=>x+1);}}>Tải lại</button>
  </div>
  {error?<div className={styles.error} role="alert">{error}
    {pendingCommand?<button type="button" className="secondary-btn" disabled={busy}
     onClick={()=>{const pending=pendingCommand;if(pending)void run(pending);}}>Thử lại lệnh</button>:null}
   </div>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  {load.state==="loading"?<p role="status">Đang tải chuyên đề từ Core…</p>:null}
  {load.state==="error"?<div role="alert" className={styles.error}>{load.error}
   <button type="button" className="secondary-btn" onClick={()=>setRevision(x=>x+1)}>Thử lại</button></div>:null}
  {data?<div className={styles.stack}>
   <section className="v24-prop-section">
    <h3>Chuyên đề đã cấp</h3>
    {data.grants.length?data.grants.map(grant=>{
      const item=byId.get(grant.specialtyId);
      const effective=grant.effectiveFrom<=today;
      return <article key={grant.id} className={styles.grant} aria-label={item?.name??grant.specialtyId}>
       <div className={styles.grantHead}><div>
        <strong>{item?.name??"Chuyên đề không còn trong Catalog ACTIVE"}</strong>
        <span>{grant.effectiveFrom} · v{grant.version} · {effective?"Đã hiệu lực":"Chưa hiệu lực"}</span>
       </div><label className={styles.checkbox}>
        <input type="checkbox" aria-label={`Hoàn thành ${item?.name??grant.specialtyId}`}
         checked={grant.completed} onChange={()=>toggle(grant)}
         disabled={!canAct||!effective||busy||Boolean(pendingCommand)}/>
        Hoàn thành
       </label></div>
       <div className={styles.audit}>
        <span>Ngày tạo: <b>{vnTime(grant.createdAt)}</b></span>
        <span>Người tạo: <b>—</b></span>
        <span>Chỉnh sửa lúc: <b>{vnTime(grant.updatedAt)}</b></span>
        <span>Người chỉnh sửa: <b>—</b></span>
       </div>
       {item?<button type="button" className="secondary-btn"
        onClick={event=>showPreview(item,event.currentTarget)}>Xem chuyên đề</button>:null}
      </article>;
    }):<p>Chưa có chuyên đề nào được cấp trong Subscription này.</p>}
   </section>
   <section className="v24-prop-section">
    <h3>Thêm chuyên đề</h3>
    {!canAct?<p className={styles.disabled} role="status">
     Subscription chưa ACTIVE, chưa có hiệu lực hoặc chưa xác nhận Center. Không thể thêm/đánh dấu hoàn thành.
    </p>:null}
    <div className={styles.actions}>
     <label>Chọn chuyên đề
      <select value={choice} onChange={event=>setChoice(event.target.value)}
       disabled={!canAct||busy||Boolean(pendingCommand)}>
       <option value="">Chọn chuyên đề cùng Path</option>
       {catalog.filter(item=>!item.alreadyGranted).map(item=><option key={item.id} value={item.id}>
        {item.name}{item.eligibleForNewGrant?"":" · Chưa đủ điều kiện"}
       </option>)}
      </select>
     </label>
     <label>Ngày hiệu lực
      <input type="date" value={effectiveFrom} min={today} onChange={event=>setEffectiveFrom(event.target.value)}
       disabled={!canAct||busy||Boolean(pendingCommand)}/>
     </label>
     <button type="button" className="secondary-btn" disabled={!chosen}
       onClick={event=>{if(chosen)showPreview(chosen,event.currentTarget);}}>Xem trước</button>
     <button type="button" className="primary-btn" disabled={!canAct||!chosenEligible||effectiveFrom<today||busy||Boolean(pendingCommand)}
       onClick={create}>Thêm chuyên đề</button>
    </div>
    {chosen&&!chosenEligible?<p role="status" className={styles.disabled}>
     {chosen.alreadyGranted?"Chuyên đề đã được cấp.":`Cần hoàn thành chuyên đề tiền đề trong cùng Subscription: ${chosen.missingPrerequisiteIds.map(id=>byId.get(id)?.name??id).join(", ")||"Chưa đủ điều kiện"}`}
    </p>:null}
    {!catalog.length?<p>Không có Chuyên đề ACTIVE cùng Path để chọn.</p>:null}
   </section>
  </div>:null}
  {preview&&!fullPreview?<BoQuickView key={preview.id} module={previewModule} record={previewRecord(preview)}
   onClose={closePreview} onDetail={()=>setFullPreview(true)} />:null}
  {preview&&fullPreview?<div className={styles.full} role="dialog" aria-modal="true"
   aria-label={`Chi tiết chuyên đề ${preview.name}`}>
   <DetailFrame title={preview.name} subtitle={preview.id}
    onBack={()=>setFullPreview(false)} tabs={[{id:"Detail",label:"Thông tin"}]} selected="Detail">
    <section className="v24-prop-section"><h3>Thông tin chuyên đề</h3>
     <div className="v24-prop-grid">
      {previewModule.fields.map(field=><div key={field.key} className="v24-prop-item">
       <div className="v24-prop-key">{field.label}</div>
       <div className="v24-prop-value readonly">
        {String(previewRecord(preview)[field.key]??"—")}
       </div>
      </div>)}
     </div><p>Chỉ xem trước — không thực hiện cấp chuyên đề.</p>
    </section>
   </DetailFrame>
  </div>:null}
 </section>;
}
