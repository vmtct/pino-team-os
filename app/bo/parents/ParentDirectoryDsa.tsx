"use client";
/** PAP-1814 · Epic PAP-1384 / SCH-PARENTS-GUARDIANS.
 * Native BO DSA Parent Table → Quick Drawer → Full Detail.
 * No TDD registry/controller/surface adapter; Core owns scope and writes.
 */
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoQuickView } from "@/app/bo/components/registration/BoQuickView";
import { BoTableSettings, type BoSavedView } from "@/app/bo/components/registration/BoTableSettings";
import { BoParentReadTabs } from "@/app/bo/components/registration/BoParentReadTabs";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { BoApplicationShellContext } from "@/app/bo/shell/BoApplicationShellContext";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { defaultTable, type BoRecord, type BoTableState } from "@/lib/bo-registration";
import { ParentCreateDrawer } from "./ParentCreateDrawer";
import { parentNativeModule } from "./parent-native-model";
import { loadNativeParentContext, loadNativeParentDirectory, nativeParentUuid,
  saveNativeParentName, type NativeParentRow } from "./parent-native-data";

const initial = (): BoTableState => ({ ...defaultTable(parentNativeModule.fields), pageSize: 15 });
type ViewName = "all" | "linked" | "unlinked";
const viewLabels: ReadonlyArray<{id:ViewName;title:string}> = [
  {id:"all",title:"Tất cả"}, {id:"linked",title:"Có học viên"}, {id:"unlinked",title:"Chưa liên kết"},
];
function recordHref(id:string|null) {
  const url=new URL(window.location.href);
  if(id)url.searchParams.set("record",id);else url.searchParams.delete("record");
  return url.pathname+url.search+url.hash;
}
function readableError(cause:unknown) {
  return cause instanceof Error ? cause.message : "Không thể tải Parent từ Core.";
}

export function ParentDirectoryDsa() {
  const center=useBoCenterSelection(), menu=useContext(BoApplicationShellContext);
  const id=center && !center.loading && !center.error ? center.selected : "";
  useEffect(()=>{document.title="Parents & Guardians · PINO BO";},[]);
  return <section aria-label="Parents & Guardians" data-parent-native-dsa="PAP-1814">
    {!center ? <p role="alert">Không tìm thấy Center context.</p> :
      center.loading ? <p role="status">Đang xác thực cơ sở…</p> :
      center.error ? <p role="alert">{center.error}</p> :
      !id ? <p role="status">Chọn cơ sở được cấp quyền để xem Parent.</p> :
      <ScopedParents key={id+":"+center.source} centerId={id}
        centerName={center.centers.find(x=>x.id===id)?.displayName} menu={menu?.("menu-btn")}/>}
  </section>;
}
function ScopedParents({centerId,centerName,menu}:{centerId:string;centerName?:string;menu?:React.ReactNode}) {
  const [table,setTable]=useState<BoTableState>(initial);
  const [rows,setRows]=useState<NativeParentRow[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=useState("");
  const [grants,setGrants]=useState<ReadonlySet<string>>(new Set());
  const [authorized,setAuthorized]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [page,setPage]=useState(1);
  const [drawer,setDrawer]=useState<NativeParentRow|null>(null);
  const [detail,setDetail]=useState<NativeParentRow|null>(null);
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState("");
  const [settings,setSettings]=useState<string|null>(null);
  const [filterOpen,setFilterOpen]=useState(false);
  const [views,setViews]=useState<BoSavedView[]>([]);
  const [activeView,setActiveView]=useState<string|null>(null);
  const [preset,setPreset]=useState<ViewName>("all");
  const invoker=useRef<HTMLElement|null>(null);
  const selectionOpen=useRef(false);
  const mutations=useRef<AbortController|null>(null);
  const update=useCallback((change:Partial<BoTableState>)=>{
    setTable(old=>({...old,...change}));setPage(1);setActiveView(null);
  },[]);
  useEffect(()=>{
    const ctl=new AbortController();
    queueMicrotask(()=>{if(!ctl.signal.aborted){setAuthorized(false);setError("");}});
    void loadNativeParentContext(centerId,ctl.signal).then(value=>{
      if(!ctl.signal.aborted){setGrants(value);setAuthorized(true);}
    }).catch(cause=>{if(!ctl.signal.aborted){setStatus("error");setError(readableError(cause));}});
    return()=>ctl.abort();
  },[centerId]);
  useEffect(()=>{
    if(!authorized)return;
    const ctl=new AbortController();
    queueMicrotask(()=>{if(!ctl.signal.aborted)setStatus("loading");});
    void loadNativeParentDirectory(centerId,ctl.signal).then(value=>{
      if(ctl.signal.aborted)return;
      setRows(value);setStatus("ready");setError("");
      const target=new URL(window.location.href).searchParams.get("record");
      if(target&&nativeParentUuid(target)) {
        const match=value.find(x=>x.id===target);
        if(match&&!selectionOpen.current){selectionOpen.current=true;setDrawer(match);}
        else if(!match)setError("Parent không tồn tại hoặc không thuộc cơ sở được cấp quyền.");
      }
    }).catch(cause=>{if(!ctl.signal.aborted){setRows([]);setStatus("error");setError(readableError(cause));}});
    return()=>ctl.abort();
  // A write refresh must never silently switch Center or broaden Directory scope.
  },[centerId,authorized,refresh]);
  useEffect(()=>{
    const onBack=()=>{
      const id=new URL(window.location.href).searchParams.get("record");
      if(!id){selectionOpen.current=false;setDrawer(null);setDetail(null);return;}
      const target=rows.find(r=>r.id===id);
      if(target&&!detail){selectionOpen.current=true;setDrawer(target);}
    };
    window.addEventListener("popstate",onBack);
    return()=>window.removeEventListener("popstate",onBack);
  },[rows,detail]);
  useEffect(()=>()=>mutations.current?.abort(),[]);
  const open=(r:BoRecord)=>{
    invoker.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const value=r as NativeParentRow;selectionOpen.current=true;setDetail(null);setDrawer(value);
    window.history.pushState(null,"",recordHref(value.id));
  };
  const close=()=>{
    selectionOpen.current=false;
    setDrawer(null);setDetail(null);
    window.history.replaceState(null,"",recordHref(null));
    requestAnimationFrame(()=>invoker.current?.focus({preventScroll:true}));
  };
  const full=()=>{if(drawer){setDetail(drawer);setDrawer(null);}};
  const saveName=async(value:string)=>{
    if(!detail || !authorized)return;
    const ctl=new AbortController();
    mutations.current?.abort();mutations.current=ctl;
    // Recheck Core actor/Center before attempting name-only PATCH.
    const current=await loadNativeParentContext(centerId,ctl.signal);
    const actual=await saveNativeParentName(centerId,detail,value,current,ctl.signal);
    if(ctl.signal.aborted)return;
    setGrants(current);setRows(list=>list.map(r=>r.id===actual.id?actual:r));
    setDetail(actual);setRefresh(n=>n+1);
    setNotice("Đã cập nhật tên Phụ huynh.");
  };
  const changePreset=(name:ViewName)=>{
    setPreset(name);setPage(1);setTable(initial());setActiveView(null);
  };
  const visible=preset==="all" ? rows :
    rows.filter(r=>preset==="linked" ? Number(r.studentCount)>0 : r.studentCount===0);
  const builtInViews=<div className="quick-views" role="group" aria-label="Lọc Parents">
    {viewLabels.map(v=><button key={v.id} type="button" aria-pressed={preset===v.id}
      className={preset===v.id?"selected":""} onClick={()=>changePreset(v.id)}>{v.title}</button>)}
  </div>;
  return <>
    {detail ? <DetailFrame title={detail.name} subtitle={detail.id} onBack={close}
      legacyContent={<BoParentReadTabs module={parentNativeModule} record={detail}
        fullDetail canEditName={grants.has("identity.parent.edit")} onSaveName={saveName}/>}>
        {null}
      </DetailFrame> :
    <section id="list-screen">
      <div className="page-heading"><div className="page-heading-left">{menu}<h1>Parents & Guardians</h1></div>
        <div className="heading-actions">{authorized&&grants.has("identity.parent.create")&&
          <button className="primary-btn" type="button" onClick={()=>setCreating(true)}>＋ Parent</button>}</div>
      </div>
      {notice&&<p role="status">{notice}</p>}
      {error&&<p role="alert">{error} <button type="button" onClick={()=>setRefresh(x=>x+1)}>Thử lại</button></p>}
      {!authorized ? <p role="status">Đang xác minh quyền theo Center…</p> :
        <BoDataTable module={parentNativeModule} rows={visible}
          loadState={status} value={table} update={update} page={page} setPage={setPage}
          onOpen={open} selected={drawer?.id} builtInViews={builtInViews}
          onSettings={setSettings} filterOpen={filterOpen} setFilterOpen={setFilterOpen}
          views={views} changeViews={setViews} activeView={activeView}
          applyView={view=>{setTable(view?.state??initial());setActiveView(view?.id??null);setPage(1);}}
          reset={()=>{setTable(initial());setPage(1);setActiveView(null);}}
          undo={()=>{}} canUndo={false}/>}
    </section>}
    {drawer&&!detail&&<BoQuickView module={parentNativeModule} moduleKey="parents" record={drawer}
      onClose={close} onDetail={full}/>}
    {creating&&authorized&&grants.has("identity.parent.create")&&
      <ParentCreateDrawer centerId={centerId} centerName={centerName}
        onClose={()=>setCreating(false)} onCreated={()=>{setCreating(false);setNotice("Đã tạo Parent.");
          setRefresh(n=>n+1);}}/>}
    {settings&&<BoTableSettings screen={settings} setScreen={setSettings}
      onClose={()=>setSettings(null)} fields={parentNativeModule.fields} rows={visible}
      value={table} update={update} views={views} setViews={setViews}
      applyView={v=>{setTable(v.state);setActiveView(v.id);setPage(1);}}/>}
  </>;
}
