"use client";
/** PAP-2096 / PAP-8 — native S2 Create/View, retaining admitted S1 shell and legacy list/detail. */
import {useContext,useEffect,useRef,useState} from "react";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoFullDetail} from "@/app/bo/components/registration/BoFullDetail";
import {defaultTable,type BoRecord,type BoTableState} from "@/lib/bo-registration";
import type {BoSavedView} from "@/app/bo/components/registration/BoTableSettings";
import {hoA1Modules} from "@/lib/ho-a1";
import {hoRecordId} from "@/lib/ho-routes";
import {HoWorldDrawer} from "./HoWorldDrawer";
import {createWorldAndReadback,loadWorlds} from "./world-client";
const legacyModule=hoA1Modules.worlds;
type Mode="create"|"view"|"detail"|null;
export function HoWorldCatalog({canManage}:{canManage:boolean}){
 const menu=useContext(TddHostMenu);
 const [rows,setRows]=useState<BoRecord[]>([]),[load,setLoad]=useState("loading"),[refresh,setRefresh]=useState(0);
 const [mode,setMode]=useState<Mode>(null),[selected,setSelected]=useState<BoRecord|null>(null),[notice,setNotice]=useState("");
 const [table,setTable]=useState<BoTableState>(()=>defaultTable(legacyModule.fields)),[page,setPage]=useState(1);
 const [filter,setFilter]=useState(false),[views,setViews]=useState<BoSavedView[]>([]),[activeView,setActiveView]=useState<string|null>(null);
 const opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const ctl=new AbortController();
  void loadWorlds(fetch,ctl.signal).then(records=>{
   if(ctl.signal.aborted)return;
   setRows(records);setLoad("ready");
   const ref=hoRecordId(new URL(location.href).searchParams.get("record"));
   if(ref){const record=records.find(r=>r.id===ref);if(record){setSelected(record);setMode(m=>m==="detail"?"detail":"view");}else{setSelected(null);setMode(null);setNotice("Bản ghi trong liên kết không còn trong danh mục hoặc không có quyền xem.");}}
  }).catch(e=>{if(!ctl.signal.aborted){setRows([]);setLoad(e instanceof Error?e.message:"Không thể tải danh mục World.");}});
  return()=>ctl.abort();
 },[refresh]);
 useEffect(()=>{
  const sync=()=>{const ref=hoRecordId(new URL(location.href).searchParams.get("record"));const record=rows.find(r=>r.id===ref);setSelected(record??null);setMode(record?"view":null);};
  window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
 },[rows]);
 function writeRef(id:string|null){const u=new URL(location.href);if(id)u.searchParams.set("record",id);else u.searchParams.delete("record");window.history.replaceState(null,"",u);}
 function choose(record:BoRecord){opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSelected(record);setMode("view");writeRef(record.id);}
 function close(){setMode(null);setSelected(null);writeRef(null);requestAnimationFrame(()=>opener.current?.focus({preventScroll:true}));}
 function created(record:BoRecord){setSelected(record);setMode("view");writeRef(record.id);setNotice("Đã tạo bản nháp và xác minh Core readback.");setRefresh(x=>x+1);}
 function reload(){setLoad("loading");setRefresh(x=>x+1);}
 if(mode==="detail"&&selected)return <BoFullDetail module={legacyModule} moduleKey="worlds" record={selected} mobileMenu={menu("detail-menu-btn")} onBack={()=>setMode("view")}/>;
 return <section id="list-screen" data-pap2096-native-dsa="">
  <div className="page-heading"><div className="page-heading-left">{menu("menu-btn")}<h1>Danh mục thế giới</h1></div><div className="heading-actions">{canManage&&load==="ready"&&<button id="add-record" type="button" className="primary-btn" onClick={e=>{opener.current=e.currentTarget;setNotice("");setSelected(null);setMode("create");}}>Tạo World</button>}</div></div>
  {notice&&<p role="status" className="settings-hint">{notice}</p>}
  {load!=="ready"&&load!=="loading"&&<div role="alert">{load} <button type="button" className="secondary-btn" onClick={reload}>Thử lại</button></div>}
  <BoDataTable legacyStyles minimal module={legacyModule} rows={rows} loadState={load} value={table} update={next=>{setTable(s=>({...s,...next}));setPage(1)}} page={page} setPage={setPage} onOpen={choose} selected={selected?.id} onSettings={()=>{}} filterOpen={filter} setFilterOpen={setFilter} views={views} changeViews={setViews} activeView={activeView} applyView={v=>{setTable(v?.state??defaultTable(legacyModule.fields));setActiveView(v?.id??null);setPage(1)}} reset={()=>{setTable(defaultTable(legacyModule.fields));setPage(1)}} undo={()=>{}} canUndo={false}/>
  {(mode==="create"&&canManage||mode==="view"&&selected)&&<HoWorldDrawer key={mode==="create"?"create":selected?.id} record={mode==="create"?null:selected} canCreate={canManage} onClose={close} onDetail={()=>setMode("detail")} createWorld={createWorldAndReadback} onCreated={created}/>}
 </section>;
}
