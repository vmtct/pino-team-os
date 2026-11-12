"use client";
/** PAP-1841 / Epic PAP-1665 PLT-ATTR FSG3 — Founder Server Table.
 * Approved PAP-1669 FSG2 Create/View remain on the same shared BoQuickView.
 */
import { useCallback,useContext,useEffect,useMemo,useRef,useState } from "react";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { HoAttributeFullDetail } from "./HoAttributeFullDetail";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoTableSettings } from "@/app/bo/components/registration/BoTableSettings";
import { boApi } from "@/lib/bo-api";
import { LocalizedModuleTitle } from "@/lib/pino-nav-locale-context";
import {
 attributeModule,optionsField,draft,asRecord,draftRecord,editDraft,validate,
 needsOptions,ENTITY_TYPES,VALUE_TYPES,VISIBILITY,
 type AttributeDefinition,type AttributeDraft,type CenterOption
} from "@/lib/ho-attribute-model";
import {
 encodeAttributeDirectoryQuery,parseAttributePage,ATTRIBUTE_SORTS,ATTRIBUTE_STATUSES,
 type AttributeSort,type AttributeStatus
} from "@/lib/pap1841-attribute-directory-query";
import type { BoField,BoRecord,BoTableState } from "@/lib/bo-registration";
import type { TablePolicy } from "@/app/components/workspace-renderer/TablePolicy";

const endpoint="/api/ho/custom-attributes/definitions";
const editKeys=new Set(["displayName","attributeKey","entityType","valueType","scope","center","required","visibility","options"]);
const pageSizes=[8,15,30] as const;
const sortKeys:readonly string[]=ATTRIBUTE_SORTS;
const fields=attributeModule.fields.map(f=>f.key);
const TABLE_POLICY:TablePolicy={
 identity:"displayName",search:["displayName","attributeKey"],
 filter:["entityType","lifecycleState","scope","center"],
 sort:ATTRIBUTE_SORTS,group:[],edit:[],viewActions:[]
};
type Filters={entityType:string;status:string;scope:string;centerId:string};
const emptyFilters=():Filters=>({entityType:"",status:"",scope:"",centerId:""});
const emptyTable=():BoTableState=>({
 search:"",rules:[],logic:"AND",sort:"createdAt",desc:true,order:[...fields],
 visible:[...fields],group:"",collapsed:[],hiddenGroups:[],hideEmpty:true,
 pageSize:15,groupDesc:false,frozenThrough:null
});
const message=(status:number)=>status===409?"Mã thuộc tính đã tồn tại hoặc yêu cầu bị trùng."
 :status===422||status===400?"Dữ liệu thuộc tính chưa hợp lệ."
 :status===401||status===403?"Tài khoản không có quyền Founder trên HO."
 :status===503?"Dịch vụ Core đang không khả dụng. Vui lòng thử lại."
 :"Không thể tải hoặc lưu thuộc tính. Hãy thử lại.";
const isDefinition=(v:unknown):v is AttributeDefinition=>Boolean(v&&typeof v==="object"&&
 "id" in v&&typeof v.id==="string"&&"displayName" in v&&"revision" in v);
async function definitionResponse(response:Response):Promise<unknown>{
 const body=await response.json() as {data?:unknown;error?:{code?:string}};
 if(!response.ok)throw Error(message(response.status));
 if(!("data" in body))throw Error("Core không trả về dữ liệu hợp lệ.");
 return body.data;
}
function CustomAttributesFsg3(){
 const menu=useContext(TddHostMenu);
 const launch=useRef<HTMLButtonElement>(null);
 const opener=useRef<HTMLElement|null>(null);
 const replayKey=useRef("");
 const [centers,setCenters]=useState<CenterOption[]>([]);
 const [value,setValue]=useState<AttributeDraft>(draft);
 const [open,setOpen]=useState<"create"|"view"|"detail"|null>(null);
 const [selected,setSelected]=useState<AttributeDefinition|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState("");
 const [table,setTable]=useState<BoTableState>(emptyTable);
 const [filter,setFilter]=useState<Filters>(emptyFilters);
 const [searchInput,setSearchInput]=useState(""),[searchTerm,setSearchTerm]=useState("");
 const [page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [items,setItems]=useState<AttributeDefinition[]>([]);
 const [total,setTotal]=useState<number|null>(null);
 const [loadState,setLoadState]=useState("loading");
 const [hydrated,setHydrated]=useState(false);
 const [settings,setSettings]=useState<string|null>(null);
 const [filterOpen,setFilterOpen]=useState(false);
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
  const q=new URLSearchParams(window.location.search);
  const sort=q.get("sort");
  const pageSize=Number(q.get("size"));
  const size=pageSizes.some(s=>s===pageSize)?pageSize:15;
  const order=q.get("order")==="asc"?"asc":"desc";
  const activeSort=sort&&sortKeys.includes(sort)?sort:"createdAt";
  const rawPage=Number(q.get("page"));
  const savedPage=Number.isSafeInteger(rawPage)&&rawPage>0&&((rawPage-1)*size)<=10000?rawPage:1;
  const visibleKeys=q.get("columns")?.split(",").filter(k=>fields.includes(k))??fields;
  const visible=new Set(["displayName",...visibleKeys]);
  const input=q.get("search")??"";
  const clean=input.trim().slice(0,120);
  const rawType=q.get("entityType")??"";
  const rawStatus=q.get("status")??"";
  const rawScope=q.get("scope")??"";
  const rawCenter=q.get("centerId")??"";
  setTable({...emptyTable(),sort:activeSort,desc:order==="desc",pageSize:size,visible:[...visible],search:clean});
  setPage(savedPage);setSearchInput(clean);setSearchTerm(clean);
  setFilter({
   entityType:ENTITY_TYPES.some(x=>x===rawType)?rawType:"",
   status:ATTRIBUTE_STATUSES.some(x=>x===rawStatus)?rawStatus:"",
   scope:rawScope==="CENTER"||rawScope==="GLOBAL"?rawScope:"",
   centerId:/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(rawCenter)?rawCenter:""
  });
  setHydrated(true);
  });
  return()=>cancelAnimationFrame(frame);
 },[]);
 useEffect(()=>{
  let active=true;
  void boApi.centers().then(rows=>{
   if(active)setCenters(rows.filter(c=>c.status==="active").map(c=>({id:c.id,label:c.displayName})));
  }).catch(()=>{if(active)setCenters([]);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!hydrated||searchInput.trim()===searchTerm)return;
  const timer=setTimeout(()=>{
   setSearchTerm(searchInput.trim());setPage(1);
  },280);
  return()=>clearTimeout(timer);
 },[searchInput,searchTerm,hydrated]);
 const query=useMemo(()=>{
  try{return encodeAttributeDirectoryQuery({
   limit:table.pageSize,offset:(page-1)*table.pageSize,
   sort:table.sort as AttributeSort,order:table.desc?"desc":"asc",
   ...(searchTerm?{search:searchTerm}:{}),
   ...(filter.entityType?{entityType:filter.entityType}:{}),
   ...(filter.status?{status:filter.status as AttributeStatus}:{}),
   ...(filter.scope?{scope:filter.scope as "GLOBAL"|"CENTER"}:{}),
   ...(filter.centerId?{centerId:filter.centerId}:{})
  }).toString();}
  catch{return null;}
 },[page,table.pageSize,table.sort,table.desc,searchTerm,filter]);
 useEffect(()=>{
  if(!hydrated)return;
  const params=new URLSearchParams(window.location.search);
  for(const k of ["search","sort","order","entityType","status","scope","centerId","size","page","columns"])params.delete(k);
  if(searchTerm)params.set("search",searchTerm);
  if(table.sort!=="createdAt")params.set("sort",table.sort);
  if(!table.desc)params.set("order","asc");
  if(table.pageSize!==15)params.set("size",String(table.pageSize));
  if(page>1)params.set("page",String(page));
  if(filter.entityType)params.set("entityType",filter.entityType);
  if(filter.status)params.set("status",filter.status);
  if(filter.scope)params.set("scope",filter.scope);
  if(filter.centerId)params.set("centerId",filter.centerId);
  if(table.visible.length!==fields.length)params.set("columns",table.visible.join(","));
  const next=window.location.pathname+(params.size?"?"+params.toString():"")+window.location.hash;
  window.history.replaceState(window.history.state,"",next);
 },[hydrated,page,table.sort,table.desc,table.pageSize,table.visible,filter,searchTerm]);
 useEffect(()=>{
  if(!hydrated)return;
  const controller=new AbortController();
  if(query===null){
   queueMicrotask(()=>{if(controller.signal.aborted)return;setItems([]);setTotal(null);setLoadState("Bộ lọc chưa hợp lệ.");});
   return()=>controller.abort();
  }
  queueMicrotask(()=>{if(!controller.signal.aborted)setLoadState("loading");});
  void (async()=>{
   try{
    const body=await definitionResponse(await fetch(endpoint+"?"+query,{
     signal:controller.signal,cache:"no-store"
    }));
    const result=parseAttributePage(body,table.pageSize,(page-1)*table.pageSize);
    if(controller.signal.aborted)return;
    if(result.total>0&&(page-1)*table.pageSize>=result.total){
     setPage(Math.max(1,Math.ceil(result.total/table.pageSize)));return;
    }
    setItems(result.items);setTotal(result.total);setLoadState("ready");
   }catch(err){
    if(controller.signal.aborted)return;
    setItems([]);setTotal(null);setLoadState(err instanceof Error?err.message:"Danh sách Core không khả dụng.");
   }
  })();
  return()=>controller.abort();
 },[hydrated,query,page,table.pageSize,refresh]);
 const records=useMemo(()=>items.map(item=>asRecord(item,centers)),[items,centers]);
 const filterRules=useMemo<BoTableState["rules"]>(()=>{
  const rules:BoTableState["rules"]=[];
  const add=(field:string,value:string)=>{if(value)rules.push({field,op:"eq",value,second:""});};
  add("entityType",filter.entityType);
  add("lifecycleState",filter.status);
  add("scope",filter.scope);
  add("center",filter.centerId?(centers.find(c=>c.id===filter.centerId)?.label??"Trung tâm"):"");
  return rules;
 },[filter,centers]);
 const tableWithServerFilters=useMemo(()=>({...table,search:searchInput,rules:filterRules}),[table,searchInput,filterRules]);
 useEffect(()=>{
  if(!filterOpen)return;
  const onKey=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   event.preventDefault();setFilterOpen(false);
   document.getElementById("filter-toggle")?.focus({preventScroll:true});
  };
  const onOutside=(event:PointerEvent)=>{
   if(event.target instanceof Element&&!event.target.closest("#rules-panel,#filter-toggle"))setFilterOpen(false);
  };
  document.addEventListener("keydown",onKey);
  document.addEventListener("pointerdown",onOutside);
  return()=>{document.removeEventListener("keydown",onKey);document.removeEventListener("pointerdown",onOutside);};
 },[filterOpen]);
 const setServerPage=useCallback((next:number)=>{
  if(Number.isSafeInteger(next)&&next>=1&&((next-1)*table.pageSize)<=10000)setPage(next);
 },[table.pageSize]);
 const updateTable=useCallback((patch:Partial<BoTableState>)=>{
  if(patch.sort!==undefined&&!sortKeys.includes(patch.sort))return;
  if(patch.pageSize!==undefined&&!pageSizes.some(s=>s===patch.pageSize))return;
  if(patch.search!==undefined)setSearchInput(patch.search.slice(0,120));
  if(patch.rules!==undefined){
   const active=new Set(patch.rules.map(rule=>rule.field));
   setFilter(prev=>({
    entityType:active.has("entityType")?prev.entityType:"",
    status:active.has("lifecycleState")?prev.status:"",
    scope:active.has("scope")?prev.scope:"",
    centerId:active.has("center")?prev.centerId:""
   }));
   setPage(1);
  }
  setTable(prev=>{
   const next={...prev,...patch};
   next.visible=[...new Set(["displayName",...next.visible.filter(key=>fields.includes(key))])];
   next.order=[...new Set([...next.order.filter(key=>fields.includes(key)),...fields])];
   // Server owns filtering, grouping, sorting and count. Never locally filter a partial page.
   next.rules=[];next.group="";
   if(next.pageSize!==prev.pageSize||next.sort!==prev.sort||next.desc!==prev.desc)setPage(1);
   return next;
  });
 },[]);
 const setFilterKey=(key:keyof Filters,v:string)=>{setFilter(old=>({...old,[key]:v}));setPage(1);};
 const reset=()=>{
  setTable(emptyTable());setFilter(emptyFilters());setPage(1);
  setSearchInput("");setSearchTerm("");setStatus("");setFilterOpen(false);
 };
 const openView=(record:BoRecord)=>{
  opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const item=items.find(v=>v.id===record.id);if(item){setSelected(item);setOpen("view");}
 };
 const launchCreate=()=>{
  opener.current=launch.current;
  replayKey.current=crypto.randomUUID();
  setValue(draft());setError("");setSettings(null);setOpen("create");
 };
 const close=()=>{
  setOpen(null);setError("");
  requestAnimationFrame(()=>{const current=opener.current;
   if(current?.isConnected)current.focus({preventScroll:true});else launch.current?.focus();});
 };
 const createFields:BoField[]=[...attributeModule.fields,...(needsOptions(value.valueType)?[optionsField]:[])];
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
   if(!isDefinition(created))throw Error("Core không trả về thuộc tính vừa tạo.");
   const read=await definitionResponse(await fetch(endpoint+"/"+encodeURIComponent(created.id),{cache:"no-store"}));
   if(!isDefinition(read)||read.id!==created.id||read.attributeKey!==value.attributeKey)
    throw Error("Core readback chưa khớp bản ghi vừa tạo.");
   const checkQuery=encodeAttributeDirectoryQuery({
    limit:50,offset:0,sort:"createdAt",order:"desc",search:created.attributeKey
   });
   const verify=await definitionResponse(await fetch(endpoint+"?"+checkQuery,{cache:"no-store"}));
   const check=parseAttributePage(verify,50,0);
   if(!check.items.some(item=>item.id===created.id))
    throw Error("Bản ghi chưa xuất hiện trong danh sách Core.");
   setSelected(read);setRefresh(n=>n+1);
   setStatus("Đã tạo bản nháp và xác minh Core readback.");
   setOpen("view");
  }catch(e){setError(e instanceof Error?e.message:"Không thể lưu thuộc tính.");}
  finally{setBusy(false);}
 };
 // PAP-1883 / PAP-1665 PLT-ATTR FSG4: state-to-surface route for native DSA Full Detail.
 if(open==="detail"&&selected)return <HoAttributeFullDetail key={selected.id} id={selected.id}
  centers={centers} mobileMenu={menu("menu-btn")} onBack={close}/>;
 return <section id="list-screen" data-plt-attr-stage="fsg3-server-table" data-tdd-shell="table">
  <div className="page-heading"><div className="page-heading-left">
   {menu("menu-btn")}<h1><LocalizedModuleTitle label="Custom Attributes" moduleKey="customAttributes"/></h1>
  </div><button ref={launch} type="button" className="primary-btn" onClick={launchCreate}>＋ Tạo thuộc tính</button></div>
  {status?<p role="status" className="settings-hint">{status}</p>:null}
  <BoDataTable module={attributeModule} rows={records} loadState={loadState} value={tableWithServerFilters}
   update={updateTable} page={page} setPage={setServerPage} onOpen={openView}
   selected={selected?.id} onSettings={setSettings}
   filterOpen={filterOpen} setFilterOpen={setFilterOpen}
   filterContent={
    <div id="rules-panel" className="rules-panel" role="region" aria-label="Bộ lọc thuộc tính">
     <div className="rules-combine"><span>Khớp tất cả điều kiện (AND) · Core</span></div>
     <div className="rule-row" data-filter-row="entityType">
      <label htmlFor="attr-filter-module">Module</label>
      <select id="attr-filter-module" className="rule-value-input" data-filter="entityType"
       aria-label="Lọc Module" value={filter.entityType}
       onChange={e=>setFilterKey("entityType",e.target.value)}>
       <option value="">Tất cả</option>{ENTITY_TYPES.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
     </div>
     <div className="rule-row" data-filter-row="status">
      <label htmlFor="attr-filter-status">Vòng đời</label>
      <select id="attr-filter-status" className="rule-value-input" data-filter="status"
       aria-label="Lọc vòng đời" value={filter.status}
       onChange={e=>setFilterKey("status",e.target.value)}>
       <option value="">Tất cả</option>{ATTRIBUTE_STATUSES.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
     </div>
     <div className="rule-row" data-filter-row="scope">
      <label htmlFor="attr-filter-scope">Phạm vi</label>
      <select id="attr-filter-scope" className="rule-value-input" data-filter="scope"
       aria-label="Lọc phạm vi" value={filter.scope}
       onChange={e=>setFilterKey("scope",e.target.value)}>
       <option value="">Tất cả</option><option value="GLOBAL">GLOBAL</option><option value="CENTER">CENTER</option>
      </select>
     </div>
     <div className="rule-row" data-filter-row="centerId">
      <label htmlFor="attr-filter-center">Trung tâm</label>
      <select id="attr-filter-center" className="rule-value-input" data-filter="centerId"
       title="Center được chọn bao gồm thuộc tính GLOBAL" aria-label="Lọc trung tâm" value={filter.centerId}
       onChange={e=>setFilterKey("centerId",e.target.value)}>
       <option value="">Tất cả</option>{centers.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
     </div>
     <div className="rules-actions">
      <button id="clear-rules" className="rule-clear" type="button" onClick={()=>{
       setFilter(emptyFilters());setPage(1);
      }}>Xóa bộ lọc</button>
     </div>
    </div>
   }
   views={[]} changeViews={()=>{}} activeView={null} applyView={()=>{}}
   reset={reset} undo={()=>{}} canUndo={false} showChrome={true}
   serverTotal={total??0} totalKnown={loadState==="ready"}
   policy={TABLE_POLICY} freezeEnabled={false} />
  {settings?<BoTableSettings screen={settings} setScreen={setSettings}
   onClose={()=>{setSettings(null);requestAnimationFrame(()=>document.getElementById("visible-columns")?.focus({preventScroll:true}));}}
   fields={attributeModule.fields} rows={records} value={table} update={updateTable}
   views={[]} setViews={()=>{}} applyView={()=>{}} policy={TABLE_POLICY}/>:null}
  {open==="create"?<BoQuickView module={attributeModule} record={null} onClose={close}
   create={{
    title:"Tạo thuộc tính",path:"System · Custom Attributes",draft:draftRecord(value,centers),
    fields:createFields,editable:f=>editKeys.has(f.key)&&(f.key!=="center"||value.scope==="CENTER")&&
     (f.key!=="options"||needsOptions(value.valueType)),
    editorField,onChange:(key,raw)=>{setValue(old=>editDraft(old,key,raw,centers));setError("");},
    onCreate:create,busy,error
   }}/>:null}
  {open==="view"&&selected?<BoQuickView module={attributeModule}
   record={asRecord(selected,centers)} onDetail={()=>setOpen("detail")} onClose={close}/>:null}
 </section>;
}
export default function HoCustomAttributesPage(){
 return <HoWorkspace module="customAttributes" content={<CustomAttributesFsg3/>}/>;
}
