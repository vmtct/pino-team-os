"use client";
/**
 * PAP-1496 / PAP-1491 SPEC-UNLOCK.
 * Subscription × Specialty owns all commands; catalog previews never write.
 * The shared PINO BO DrawerFrame / DetailFrame are retained as renderer owners.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {subscriptionSpecialtyClient,BoApiError} from "@/lib/bo-subscription-specialty-client";
import type {BoSubscriptionSpecialtyRead,BoSubscriptionSpecialtyCatalogItem,BoSubscriptionSpecialtyGrant} from "@/lib/bo-subscription-specialty-model";
import {defaultTable,type BoModule,type BoRecord,type BoTableState} from "@/lib/bo-registration";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoTableSettings,type BoSavedView} from "@/app/bo/components/registration/BoTableSettings";
import {BoLinkedSpecialtyDrawer,type LinkedSpecialtyBinding} from "./BoLinkedSpecialtyDrawer";
import styles from "./subscription-specialty.module.css";

type Load={state:"loading"}|{state:"error";error:string}|{state:"ready";data:BoSubscriptionSpecialtyRead};
type Command={
 kind:"grant"|"completion";key:string;subscriptionId:string;centerId:string;
 grant?:{specialtyId:string;effectiveFrom:string;expectedVersion:0};
 completion?:{grantId:string;completed:boolean;expectedVersion:number};
};
const grantModule:BoModule={label:"Chuyên đề đã cấp",group:"Học tập",fields:[
 {key:"name",label:"Chuyên đề",type:"text",icon:"Aa",w:220,readonly:true},
 {key:"completed",label:"Hoàn thành",type:"boolean",icon:"✓",w:120},
 {key:"effectiveFrom",label:"Ngày hiệu lực",type:"date",icon:"◷",w:145,readonly:true},
 {key:"status",label:"Trạng thái",type:"select",icon:"●",w:145,readonly:true},
 {key:"version",label:"Phiên bản",type:"number",icon:"#",w:90,readonly:true},
 {key:"createdAt",label:"Ngày tạo",type:"datetime",icon:"◷",w:160,readonly:true},
 {key:"createdBy",label:"Người tạo",type:"text",icon:"Aa",w:150,readonly:true},
 {key:"updatedAt",label:"Chỉnh sửa lúc",type:"datetime",icon:"◷",w:165,readonly:true},
 {key:"updatedBy",label:"Người chỉnh sửa",type:"text",icon:"Aa",w:150,readonly:true}
]};
const localDate=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const message=(error:unknown)=>error instanceof BoApiError
 ?`${error.message}${error.requestId?` · ${error.requestId}`:""}`
 :error instanceof Error?error.message:"Không thể tải dữ liệu Chuyên đề.";
function accessible(data:BoSubscriptionSpecialtyRead,today:string){
 const sub=data.subject;
 return sub.lifecycle==="ACTIVE"&&Boolean(sub.serviceStartsOn)&&
  sub.serviceStartsOn!<=today&&(!sub.contractualEndsOn||sub.contractualEndsOn>=today);
}
export function BoSubscriptionSpecialtyTab({subscriptionId,centerId,centerReady,linkedSpecialty}:{
 subscriptionId:string;centerId:string;centerReady:boolean;linkedSpecialty?:LinkedSpecialtyBinding;
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
 const [table,setTable]=useState<BoTableState>(()=>defaultTable(grantModule.fields));
 const [page,setPage]=useState(1),[filterOpen,setFilterOpen]=useState(false),[settings,setSettings]=useState<string|null>(null);
 const [views,setViews]=useState<BoSavedView[]>([]),[activeView,setActiveView]=useState<string|null>(null);

 const nextRequest=useRef(0);
 const previewReturn=useRef<HTMLButtonElement|null>(null);
 const today=localDate();
 const refresh=useCallback(async()=>{
  if(!centerReady||!centerId){setLoad({state:"error",error:"Hãy chọn Center có quyền để xem Subscription."});return;}
  const token=++nextRequest.current;
  setLoad({state:"loading"});
  try{
   const data=await subscriptionSpecialtyClient.read(subscriptionId,centerId);
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
 const grantRows:BoRecord[]=(data?.grants??[]).map(g=>({id:g.id,name:byId.get(g.specialtyId)?.name??"Chuyên đề không còn trong Catalog ACTIVE",completed:g.completed,effectiveFrom:g.effectiveFrom,status:g.effectiveFrom<=today?"Đã hiệu lực":"Chưa hiệu lực",version:g.version,createdAt:g.createdAt,createdBy:null,updatedAt:g.updatedAt,updatedBy:null}));
 const updateTable=(patch:Partial<BoTableState>)=>{setTable(v=>({...v,...patch}));setPage(1);};
 const chosen=catalog.find(item=>item.id===choice)??null;
 const chosenEligible=Boolean(chosen?.eligibleForNewGrant&&!chosen?.alreadyGranted);
 const run=async(command:Command)=>{
  if(busy||!centerReady||command.centerId!==centerId||command.subscriptionId!==subscriptionId)return;
  if(pendingCommand&&pendingCommand.key!==command.key)return;
  setPendingCommand(command);setBusy(true);setError(null);setNotice(null);
  try{
   if(command.kind==="grant"){
    if(!command.grant)throw new Error("Thiếu dữ liệu cấp chuyên đề.");
    await subscriptionSpecialtyClient.create(subscriptionId,centerId,command.grant,command.key);
   }else{
    if(!command.completion)throw new Error("Thiếu dữ liệu hoàn thành.");
    await subscriptionSpecialtyClient.complete(subscriptionId,command.completion.grantId,centerId,
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
 const showPreview=(item:BoSubscriptionSpecialtyCatalogItem,origin:HTMLButtonElement|null)=>{
  previewReturn.current=origin;setPreview(item);
 };
 const closePreview=()=>{setPreview(null);requestAnimationFrame(()=>previewReturn.current?.focus());};
 return <section aria-label="Chuyên đề theo Subscription" data-pap1496-subscription={subscriptionId}
 className={styles.root}>
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
    <h3>Thêm chuyên đề</h3>
    {!canAct?<p className={styles.disabled} role="status">
     Subscription chưa ACTIVE, chưa có hiệu lực hoặc chưa xác nhận Center. Không thể thêm/đánh dấu hoàn thành.
    </p>:null}
    <div className={styles.actions}>
     <label className={styles.field}>Chọn chuyên đề
      <select className={"edit-input "+styles.control} value={choice} onChange={event=>setChoice(event.target.value)}
       disabled={!canAct||busy||Boolean(pendingCommand)}>
       <option value="">Chọn chuyên đề cùng Path</option>
       {catalog.filter(item=>!item.alreadyGranted).map(item=><option key={item.id} value={item.id}>
        {item.name}{item.eligibleForNewGrant?"":" · Chưa đủ điều kiện"}
       </option>)}
      </select>
     </label>
     <label className={styles.field}>Ngày hiệu lực
      <input className={"edit-input "+styles.control} type="date" value={effectiveFrom} min={today} onChange={event=>setEffectiveFrom(event.target.value)}
       disabled={!canAct||busy||Boolean(pendingCommand)}/>
     </label>
     <button type="button" className="secondary-btn" disabled={!chosen}
       onClick={event=>{if(chosen)showPreview(chosen,event.currentTarget);}}>Xem trước</button>
     <button type="button" className="primary-btn" disabled={!canAct||!chosenEligible||effectiveFrom<today||busy||Boolean(pendingCommand)}
       onClick={create}>Thêm chuyên đề</button>
    </div>
    {chosen&&!chosenEligible?<div role="status" className={"edit-error "+styles.prerequisiteWarning}>
     {chosen.alreadyGranted?"Chuyên đề đã được cấp.":<><strong>Cần hoàn thành chuyên đề tiền đề trong cùng Subscription:</strong>{" "}{chosen.missingPrerequisiteIds.length?chosen.missingPrerequisiteIds.map((id,index)=>{const item=byId.get(id);return <span key={id}>{index?", ":""}{item?<button type="button" className="secondary-btn" onClick={event=>showPreview(item,event.currentTarget)}>{item.name}</button>:id}</span>;}):"Chưa đủ điều kiện"}</>}
    </div>:null}
    {!catalog.length?<p>Không có Chuyên đề ACTIVE cùng Path để chọn.</p>:null}
   </section>
   <section className="v24-prop-section">
    <h3>Chuyên đề đã cấp</h3>
    <div data-tdd-shell="" data-tdd-table="" data-tdd-freeze-controls="" className={styles.tableWrap}>
     <BoDataTable minimal showChrome={false} totalKnown={false} module={grantModule} rows={grantRows} loadState="ready" value={{...table,pageSize:Math.max(1,grantRows.length)}} update={updateTable} page={page} setPage={setPage} onOpen={row=>{const g=data.grants.find(x=>x.id===row.id),item=g&&byId.get(g.specialtyId);if(item)showPreview(item,document.activeElement instanceof HTMLButtonElement?document.activeElement:null);}} onCellEdit={row=>{const g=data.grants.find(x=>x.id===row.id);if(g)toggle(g);}} policy={{identity:"name",search:grantModule.fields.map(f=>f.key),filter:grantModule.fields.map(f=>f.key),sort:grantModule.fields.map(f=>f.key),group:[],edit:canAct&&!busy&&!pendingCommand?["completed"]:[],viewActions:[]}} onSettings={setSettings} filterOpen={filterOpen} setFilterOpen={setFilterOpen} views={views} changeViews={setViews} activeView={activeView} applyView={v=>{setTable(v?.state??defaultTable(grantModule.fields));setActiveView(v?.id??null);setPage(1);}} reset={()=>{setTable(defaultTable(grantModule.fields));setPage(1);setActiveView(null);}} undo={()=>{}} canUndo={false}/>
    </div>
    {settings?<BoTableSettings screen={settings} setScreen={setSettings} onClose={()=>setSettings(null)} fields={grantModule.fields} rows={grantRows} value={table} update={updateTable} views={views} setViews={setViews} applyView={v=>{setTable(v.state);setActiveView(v.id);setPage(1);}}/>:null}
   </section>
  </div>:null}
  {preview?<BoLinkedSpecialtyDrawer key={preview.id} subject={{specialtyId:preview.id,pathProgramId:preview.pathProgramId,subscriptionId,centerId}} binding={linkedSpecialty} onClose={closePreview}/>:null}
 </section>;
}
