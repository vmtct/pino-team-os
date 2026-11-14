"use client";
/** PAP-1978 / PAP-1974 native DSA module; host must supply confirmed Founder manage authority. */
import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {BoTableSettings,type BoSavedView} from "@/app/bo/components/registration/BoTableSettings";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {defaultTable,type BoField,type BoModule,type BoRecord,type BoTableState,type BoValue} from "@/lib/bo-registration";
import {assetUrl,slots,slotNames,type Slot,type HoSetItem,type ItemRecord,type HoItem} from "../wardrobe/item-client";
import {loadStarterCatalog,starterDraft,createStarter,updateStarter,changeStarterLifecycle,type StarterSetDraft} from "./starter-catalog-client";
import "@/app/components/pinoria-item/item-calibration.css";
import {isStarterTab,readStarterDetailRoute,starterDetailUrl,type StarterTab} from "./starter-detail-route";
const starterModule:BoModule={label:"Starter Set",group:"Pinoria",fields:[
 {key:"name",label:"Tên Starter Set",type:"text",icon:"Aa",w:220},
 {key:"preview",label:"Preview",type:"text",icon:"▣",w:90,readonly:true},
 {key:"count",label:"Số Item",type:"number",icon:"#",w:86,readonly:true},
 {key:"status",label:"Trạng thái",type:"select",icon:"◉",w:130,readonly:true,options:["DRAFT","PUBLISHED","UNPUBLISHED"]},
 {key:"createdAt",label:"Created Time",type:"datetime",icon:"◷",w:190,readonly:true},
 {key:"createdBy",label:"Created By",type:"text",icon:"Aa",w:160,readonly:true},
 {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"◷",w:190,readonly:true},
 {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",w:160,readonly:true},
]};
const detailFields:BoField[]=[...starterModule.fields,{key:"description",label:"Mô tả",type:"textarea",icon:"Aa",w:240},{key:"key",label:"Item Key",type:"text",icon:"#",w:200,readonly:true}];
const auditFields=["createdAt","createdBy","updatedAt","updatedBy"];
const sections=[{id:"info",label:"Thông tin Starter Set",fields:["name","key","description","count","status"]},{id:"audit",label:"Lịch sử hệ thống",fields:auditFields}];
const emptyDraft=():StarterSetDraft=>({key:"",displayName:"",description:"",memberItemIds:[]});
const concrete=(items:ItemRecord[]):HoItem[]=>items.filter((r):r is HoItem=>r.type!=="SET"&&r.status==="PUBLISHED");
const stack:Record<Slot,number>={AURA_GROUND:6,AURA_BACK:12,BACK:30,OUTFIT:60,HAIR:70,FACE:80,HEADWEAR:90,PATH_MARK:100};
const toRow=(r:HoSetItem):BoRecord=>({id:r.id,name:r.displayName,key:r.key,preview:"Xem chi tiết",description:r.description??"",count:r.memberCount??r.members?.length??0,status:r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,createdBy:r.createdByUserId??null,updatedBy:r.updatedByUserId??null});
const toDraftRow=(d:StarterSetDraft):BoRecord=>({id:"",name:d.displayName,key:d.key,description:d.description,count:d.memberItemIds.length,status:"DRAFT"});
const message=(e:unknown)=>e instanceof Error?e.message:"Không thể xử lý Starter Set.";
function Preview({ids,items}:{ids:string[];items:HoItem[]}){
 const found=ids.map(id=>items.find(r=>r.id===id)).filter((r):r is HoItem=>Boolean(r));
 const [failed,setFailed]=useState<string[]>([]);
 return <section className="ho-item-relations" aria-label="Preview Starter Set">
  <h3>Preview · 9:16</h3><div className="ho-rel-stage" style={{maxWidth:180}}>
   <img className="ho-rel-base" src="https://assets.pinohouse.art/pinoria/char-base.png" alt="Nhân vật nền Pinoria"/>
   {found.map(r=>{const url=assetUrl(r.asset,r.id);return url?<img key={r.id+":"+r.revision} className="ho-rel-layer" src={url+"?revision="+r.revision} alt={r.displayName}
    onError={()=>setFailed(old=>old.includes(r.id)?old:[...old,r.id])}
    style={{zIndex:stack[r.slot],transform:"translate("+(r.positionX*100)+"%,"+(r.positionY*100)+"%) scale("+r.scale+") rotate("+(r.rotationDegrees??0)+"deg)"}}/>:null})}
  </div>{found.length!==ids.length||found.some(r=>!assetUrl(r.asset,r.id)||failed.includes(r.id))?<p role="status">Một số ảnh thành viên hiện không khả dụng.</p>:null}
 </section>;
}
function Members({draft,items,disabled,onChange}:{draft:StarterSetDraft;items:HoItem[];disabled:boolean;onChange:(ids:string[])=>void}){
 const unknown=draft.memberItemIds.filter(id=>!items.some(r=>r.id===id));
 return <section className="ho-item-relations" aria-label="Thành viên">
  <h3>Thành viên</h3>{slots.map(slot=>{
   const eligible=items.filter(r=>r.slot===slot),selected=eligible.find(r=>draft.memberItemIds.includes(r.id))?.id??"";
   return <label key={slot}>{slotNames[slot]}{["HAIR","FACE","OUTFIT"].includes(slot)?" *":""}
    <select aria-label={slotNames[slot]} disabled={disabled} value={selected} onChange={e=>onChange([...draft.memberItemIds.filter(id=>!eligible.some(r=>r.id===id)),...(e.target.value?[e.target.value]:[])])}>
     <option value="">— Chọn Item —</option>{eligible.map(r=><option key={r.id} value={r.id}>{r.displayName}</option>)}
    </select></label>;
  })}
  {unknown.map(id=><p key={id}>Item không còn Published: {id} <button type="button" disabled={disabled} className="secondary-btn" onClick={()=>onChange(draft.memberItemIds.filter(x=>x!==id))}>Bỏ Item</button></p>)}
  <Preview ids={draft.memberItemIds} items={items}/>
 </section>;
}
export function HoStarterSets({canManage=false,mobileMenu}:{canManage?:boolean;mobileMenu?:ReactNode}){
 const [rows,setRows]=useState<HoSetItem[]>([]),[items,setItems]=useState<HoItem[]>([]);
 const [load,setLoad]=useState("loading"),[refresh,setRefresh]=useState(0);
 const [table,setTable]=useState<BoTableState>(()=>defaultTable(starterModule.fields)),[page,setPage]=useState(1);
 const [settings,setSettings]=useState<string|null>(null),[filter,setFilter]=useState(false),[views,setViews]=useState<BoSavedView[]>([]),[activeView,setActiveView]=useState<string|null>(null);
 const [selected,setSelected]=useState<HoSetItem|null>(null),[mode,setMode]=useState<"create"|"view"|"detail"|null>(null);
 const [tab,setTab]=useState<StarterTab>("overview"),[draft,setDraft]=useState(emptyDraft),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const busyRef=useRef(false),opener=useRef<HTMLElement|null>(null);
 const [editor,setEditor]=useState<{field:BoField;anchor:HTMLElement}|null>(null);
 useEffect(()=>{const ctl=new AbortController();void loadStarterCatalog(ctl.signal).then(r=>{if(!ctl.signal.aborted){setRows(r.starters);setItems(concrete(r.items));setLoad("ready")}}).catch(e=>{if(!ctl.signal.aborted){setRows([]);setItems([]);setLoad(message(e))}});return()=>ctl.abort()},[refresh]);
 const restore=useCallback((available:HoSetItem[])=>{
  const route=readStarterDetailRoute(window.location.search);
  if(!route){setMode(null);setSelected(null);setEditor(null);return}
  const found=available.find(r=>r.id===route.record);
  if(!found){setMode(null);setSelected(null);setNotice("Starter Set không tồn tại hoặc không còn khả dụng.");return}
  setSelected(found);setDraft(starterDraft(found));setTab(route.tab);setMode("detail");setEditor(null);setError("");
 },[]);
 useEffect(()=>{if(load!=="ready")return;const onPop=()=>restore(rows);window.addEventListener("popstate",onPop);if(readStarterDetailRoute(window.location.search))restore(rows);return()=>window.removeEventListener("popstate",onPop)},[load,rows,restore]);
 const selectDetailTab=(id:string)=>{if(!selected||!isStarterTab(id)||busyRef.current)return;setTab(id);window.history.pushState(null,"",starterDetailUrl(window.location.href,selected.id,id));setEditor(null)};
 const reset=()=>{setTable(defaultTable(starterModule.fields));setPage(1);setActiveView(null)};
 const update=useCallback((p:Partial<BoTableState>)=>{setTable(t=>({...t,...p}));setPage(1)},[]);
 const close=()=>{if(busyRef.current)return;if(readStarterDetailRoute(window.location.search))window.history.pushState(null,"",starterDetailUrl(window.location.href,null));setMode(null);setSelected(null);setEditor(null);setError("");requestAnimationFrame(()=>opener.current?.focus({preventScroll:true}))};
 const choose=(row:BoRecord)=>{const x=rows.find(r=>r.id===row.id);if(!x)return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSelected(x);setDraft(starterDraft(x));setMode("view");setError("")};
 const apply=async(fn:()=>Promise<HoSetItem>,next:"view"|"detail")=>{
  if(!canManage||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError("");setNotice("");
  try{const n=await fn();setSelected(n);setDraft(starterDraft(n));setMode(next);setEditor(null);setNotice("Đã lưu và xác minh Core readback.");setRefresh(v=>v+1)}
  catch(e){setError(message(e))}finally{busyRef.current=false;setBusy(false)}
 };
 const canEdit=canManage&&selected!==null&&selected.status!=="UNPUBLISHED"&&!busy;
 const publishReady=selected!==null&&(selected.status==="DRAFT"||(selected.status==="PUBLISHED"&&Boolean(selected.pendingDraft)))&&["HAIR","FACE","OUTFIT"].every(slot=>items.some(i=>i.slot===slot&&starterDraft(selected).memberItemIds.includes(i.id)));
 const fields=detailFields;
 if(mode==="detail"&&selected){
  const row:BoRecord={...toRow(selected),name:starterDraft(selected).displayName,key:starterDraft(selected).key,description:starterDraft(selected).description};
  return <DetailFrame title={selected.displayName} subtitle={selected.key+" · "+selected.status} mobileMenu={mobileMenu} onBack={close}
   tabs={[{id:"overview",label:"Tổng quan"},{id:"members",label:"Thành viên"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={selectDetailTab}>
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
   {tab==="overview"?<>
    <PropertySections fields={fields} record={row} sections={sections} variant="detail" canEdit={f=>canEdit&&(f.key==="name"||f.key==="key"||f.key==="description")} onEdit={(field,anchor)=>setEditor({field,anchor})}/>
    {editor&&canEdit?<BoTypedEditor field={{...editor.field,readonly:false}} value={row[editor.field.key] as BoValue} anchor={editor.anchor} closeOnSave={false}
     onClose={()=>{if(!busyRef.current)setEditor(null)}} onSave={v=>{const field=editor.field.key;void apply(()=>updateStarter(selected,{...starterDraft(selected),...(field==="name"?{displayName:String(v??"")}:field==="description"?{description:String(v??"")}:{key:String(v??"")})}),"detail")}}/>:null}
    <Preview ids={starterDraft(selected).memberItemIds} items={items}/>
    {canManage&&<div className="ho-rel-actions">
      {(selected.status==="DRAFT"||selected.pendingDraft)&&<button className="primary-btn" disabled={busy||!publishReady} onClick={()=>void apply(()=>changeStarterLifecycle(selected,"publish"),"detail")}>Publish</button>}
      {selected.status==="PUBLISHED"&&!selected.pendingDraft&&<button className="secondary-btn" disabled={busy} onClick={()=>void apply(()=>changeStarterLifecycle(selected,"unpublish"),"detail")}>Unpublish</button>}
    </div>}
   </>:tab==="members"?<>
    <Members draft={draft} items={items} disabled={!canEdit} onChange={ids=>setDraft(d=>({...d,memberItemIds:ids}))}/>
    {canEdit&&<button className="primary-btn" disabled={JSON.stringify(draft)===JSON.stringify(starterDraft(selected))} onClick={()=>void apply(()=>updateStarter(selected,draft),"detail")}>Lưu thành viên</button>}
   </>:<section aria-label="Lịch sử Starter Set">
    {selected.history?.length?<table className="pds-table"><thead><tr><th>Phiên bản</th><th>Hoạt động</th><th>Người thực hiện (ID)</th><th>Thời gian</th></tr></thead><tbody>
      {selected.history.map(h=><tr key={h.revision}><td>{h.revision}</td><td>{({CREATED:"Tạo",UPDATED:"Cập nhật",PUBLISHED:"Publish",UNPUBLISHED:"Unpublish"} as Record<string,string>)[h.action]}</td><td>{h.actorUserId}</td><td>{new Date(h.createdAt).toLocaleString("vi-VN")}</td></tr>)}
    </tbody></table>:<p role="status">Chưa có lịch sử được Core xác nhận.</p>}
   </section>}
  </DetailFrame>;
 }
 const records=rows.map(toRow);
 return <section id="list-screen" data-pap1978-native-dsa="">
  <div className="page-heading"><div className="page-heading-left">{mobileMenu}<h1>Starter Set</h1></div>
   {canManage&&load==="ready"&&<button className="primary-btn" onClick={e=>{opener.current=e.currentTarget;setDraft(emptyDraft());setError("");setMode("create")}}>Tạo Starter Set</button>}
  </div>
  {notice&&<p role="status">{notice}</p>}{load!=="ready"&&load!=="loading"&&<button className="secondary-btn" onClick={()=>setRefresh(v=>v+1)}>Thử lại</button>}
  <BoDataTable module={starterModule} rows={records} loadState={load} value={table} update={update} page={page} setPage={setPage} onOpen={choose} selected={selected?.id} onSettings={setSettings} filterOpen={filter} setFilterOpen={setFilter} views={views} changeViews={setViews} activeView={activeView} applyView={v=>{if(v){setTable(v.state);setActiveView(v.id);setPage(1)}else reset()}} reset={reset} undo={()=>{}} canUndo={false} nativeAvatarOpener/>
  {settings&&<BoTableSettings screen={settings} setScreen={setSettings} onClose={()=>setSettings(null)} fields={starterModule.fields} rows={records} value={table} update={update} views={views} setViews={setViews} applyView={v=>{setTable(v.state);setActiveView(v.id);setPage(1)}}/>}
  {mode==="view"&&selected&&<BoQuickView module={{...starterModule,fields}} record={toRow(selected)} onClose={close} onDetail={()=>{window.history.pushState(null,"",starterDetailUrl(window.location.href,selected.id));setTab("overview");setMode("detail")}} extraSection={<Preview ids={starterDraft(selected).memberItemIds} items={items}/>}/>}
  {mode==="create"&&canManage&&<DrawerFrame title="Tạo Starter Set" path="Pinoria · Starter Set" onClose={close}
    footer={<><button className="secondary-btn" disabled={busy} onClick={close}>Hủy</button><button className="primary-btn" disabled={busy||!draft.displayName.trim()||!draft.key.trim()} onClick={()=>void apply(()=>createStarter(draft),"view")}>Tạo bản nháp</button></>}>
    <PropertySections fields={fields} record={toDraftRow(draft)} sections={sections} variant="drawer" createFields={{
     name:{id:"starter-name",value:draft.displayName,onChange:v=>setDraft(d=>({...d,displayName:v})),required:true,disabled:busy,maxLength:160},
     key:{id:"starter-key",value:draft.key,onChange:v=>setDraft(d=>({...d,key:v})),required:true,disabled:busy,maxLength:120},
     description:{id:"starter-description",value:draft.description,onChange:v=>setDraft(d=>({...d,description:v})),disabled:busy,maxLength:1000}
    }}/>
    <Members draft={draft} items={items} disabled={busy} onChange={ids=>setDraft(d=>({...d,memberItemIds:ids}))}/>
    {error&&<p role="alert">{error}</p>}
   </DrawerFrame>}
 </section>;
}
