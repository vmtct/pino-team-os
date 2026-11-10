"use client";
/** PAP-1810 · Epic PAP-1705 / PNR-AVATAR-CRUD.
 * Native PINO BO DSA controller, independent of the retired schema/controller engine.
 * Core BFF authorizes each request.
 */
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { BoDataTable } from "@/app/bo/components/registration/BoDataTable";
import { BoTableSettings, type BoSavedView } from "@/app/bo/components/registration/BoTableSettings";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { BoApplicationShellContext } from "@/app/bo/shell/BoApplicationShellContext";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { defaultTable, type BoRecord, type BoTableState } from "@/lib/bo-registration";
import { avatarModule, avatarSections } from "./avatar-dsa-model";
import { loadAvatarContext, loadAvatarPage, validAvatarRowId, type AvatarRow, type AvatarPage } from "./avatar-dsa-data";
import { CreateSelfDrawer } from "./CreateSelfDrawer";
import { SelfWardrobeDetail } from "./SelfWardrobeDetail";
import { SelfLoadoutDetail } from "./SelfLoadoutDetail";

const initialTable = (): BoTableState => ({ ...defaultTable(avatarModule.fields), pageSize: 15 });
const tablePolicy = {
  identity: "name", search: ["name"], filter: ["avatarStatus", "subjectStatus"],
  sort: [], group: [], edit: [], viewActions: ["add", "apply", "rename", "delete", "reorder"],
} as const;

function recordHref(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("record", id);
  else url.searchParams.delete("record");
  return url.pathname + url.search + url.hash;
}
function dateSafeError(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải danh bạ Avatar.";
}
function AvatarDrawer({ record, onClose, onDetail }: {record: AvatarRow; onClose: () => void; onDetail: () => void}) {
  return <DrawerFrame title={record.name} path="Pinoria Avatar" onClose={onClose}
    footer={<button type="button" id="full-detail" className="primary-btn" onClick={onDetail}>↗ Full Detail</button>}>
    <PropertySections variant="drawer" fields={avatarModule.fields} record={record} sections={avatarSections}/>
  </DrawerFrame>;
}
type AvatarTab = "overview" | "wardrobe" | "loadout" | "history";
function AvatarDetail({record,centerId,grants,onBack,onSaved}:{
  record:AvatarRow;centerId:string;grants:ReadonlySet<string>;onBack:()=>void;onSaved:()=>void
}) {
  const [tab,setTab]=useState<AvatarTab>("overview");
  const tabs: {id:AvatarTab;label:string}[] = [
    {id:"overview",label:"Tổng quan"}, {id:"wardrobe",label:"Tủ đồ"},
    {id:"loadout",label:"Loadout"}, {id:"history",label:"Lịch sử"}
  ];
  return <DetailFrame title={record.name} subtitle={String(record.pinoriaSelfId ?? record.rowKey ?? "—")}
    tabs={tabs} selected={tab} onSelect={v=>setTab(v as AvatarTab)} onBack={onBack}>
    {tab==="overview" ? <PropertySections variant="detail" fields={avatarModule.fields}
      record={record} sections={avatarSections}/> :
    tab==="wardrobe" ? <SelfWardrobeDetail row={record} centerId={centerId} activeTab="wardrobe"
      canView={grants.has("pinoria.self.item.view")} canManage={grants.has("pinoria.self.item.manage")} onSaved={onSaved}/> :
    tab==="loadout" ? <SelfLoadoutDetail row={record} centerId={centerId} activeTab="loadout"
      canView={grants.has("pinoria.self.loadout.view")} canManage={grants.has("pinoria.self.loadout.manage")}
      canViewItems={grants.has("pinoria.self.item.view")} onSaved={onSaved}/> :
      <p role="status" className="v24-audit-empty">Core chưa cung cấp lịch sử sự kiện sở hữu Avatar qua BO; không tạo lịch sử giả.</p>}
  </DetailFrame>;
}

export function AvatarDirectoryDsa() {
  const center = useBoCenterSelection();
  const selected = center && !center.loading && !center.error ? center.selected : "";
  const header = useContext(BoApplicationShellContext);
  useEffect(() => { document.title = "Pinoria Avatar · PINO BO"; }, []);
  return <section aria-label="Danh bạ Pinoria Avatar">
    {!center ? <p role="alert">Không tìm thấy Center context của BO.</p> :
    center.loading ? <p role="status">Đang xác thực cơ sở được cấp quyền…</p> :
    center.error ? <p role="alert">{center.error}</p> :
    !selected ? <p role="status">Chọn trung tâm tại góc trên trái để xem Pinoria Avatar.</p> :
      <ScopedAvatarDirectory key={selected+":"+center.source} centerId={selected} menu={header?.("menu-btn")}/>}
  </section>;
}

function ScopedAvatarDirectory({centerId,menu}:{centerId:string;menu?:React.ReactNode}) {
  const [table,setTable]=useState<BoTableState>(initialTable);
  const [rows,setRows]=useState<AvatarRow[]>([]);
  const [loadState,setLoadState]=useState("loading");
  const [page,setPage]=useState(1);
  const [serverTotal,setServerTotal]=useState(0);
  const [grants,setGrants]=useState<ReadonlySet<string>>(new Set());
  const [ready,setReady]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [drawer,setDrawer]=useState<AvatarRow|null>(null);
  const [detail,setDetail]=useState<AvatarRow|null>(null);
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState("");
  const [settings,setSettings]=useState<string|null>(null);
  const [filterOpen,setFilterOpen]=useState(false);
  const [views,setViews]=useState<BoSavedView[]>([]);
  const [activeView,setActiveView]=useState<string|null>(null);
  const [error,setError]=useState("");
  const cursors=useRef<Map<number,string|null>>(new Map([[1,null]]));
  const authorized=useRef(false);
  const returnFocus=useRef<HTMLElement|null>(null);
  const queryKey=JSON.stringify([table.search,table.rules,table.pageSize]);

  const update=useCallback((patch:Partial<BoTableState>)=>{
    setTable(old=>({...old,...patch}));setPage(1);cursors.current=new Map([[1,null]]);
    setActiveView(null);
  },[]);
  const reset=useCallback(()=>{setTable(initialTable());setPage(1);cursors.current=new Map([[1,null]]);setActiveView(null);},[]);
  const onOpen=useCallback((row:BoRecord)=>{
    const typed=row as AvatarRow;
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setDrawer(typed);setDetail(null);
    window.history.pushState(null,"",recordHref(typed.id));
  },[]);
  const closeDrawer=()=>{setDrawer(null);window.history.replaceState(null,"",recordHref(null));returnFocus.current?.focus({preventScroll:true});};
  const exitDetail=()=>{setDetail(null);window.history.replaceState(null,"",recordHref(null));returnFocus.current?.focus({preventScroll:true});};
  useEffect(()=>{
    const ctl=new AbortController();
    authorized.current=false;
    queueMicrotask(()=>{if(!ctl.signal.aborted){setReady(false);setError("");}});
    void loadAvatarContext(centerId,ctl.signal).then(keys=>{
      if(ctl.signal.aborted)return;
      authorized.current=true;setGrants(keys);setReady(true);
    }).catch(cause=>{if(!ctl.signal.aborted){setError(dateSafeError(cause));setLoadState("error");}});
    return ()=>{ctl.abort();authorized.current=false;};
  },[centerId]);
  useEffect(()=>{
    if(!ready||!authorized.current)return;
    const ctl=new AbortController();
    queueMicrotask(()=>{if(!ctl.signal.aborted){setLoadState("loading");setError("");}});
    const cursor=cursors.current.get(page);
    if(cursor===undefined){setPage(1);return()=>ctl.abort();}
    void loadAvatarPage(centerId,{limit:table.pageSize,search:table.search.trim(),rules:table.rules,cursor},ctl.signal)
      .then((data:AvatarPage)=>{
        if(ctl.signal.aborted)return;
        if(data.nextCursor)cursors.current.set(page+1,data.nextCursor);
        else cursors.current.delete(page+1);
        setRows(data.records);setServerTotal((page-1)*table.pageSize+data.records.length+(data.nextCursor?1:0));
        setLoadState("ready");
      }).catch(cause=>{
        if(ctl.signal.aborted)return;
        setRows([]);setServerTotal(0);setLoadState("error");setError(dateSafeError(cause));
      });
    return ()=>ctl.abort();
  },[ready,centerId,page,queryKey,refresh,table.pageSize,table.search,table.rules]);

  // Deep links cannot rely on an in-memory TDD navigation snapshot. Bounded Core search only.
  useEffect(()=>{
    if(!ready||!authorized.current||loadState!=="ready")return;
    const target=new URL(window.location.href).searchParams.get("record");
    if(!target||drawer?.id===target||detail?.id===target)return;
    if(!validAvatarRowId(target)){queueMicrotask(()=>setError("Liên kết Avatar không hợp lệ."));return;}
    const known=rows.find(v=>v.id===target);
    if(known){queueMicrotask(()=>setDrawer(known));return;}
    const ctl=new AbortController();
    void (async()=>{
      let cursor:string|null=null;const seen=new Set<string>();
      for(let attempt=0;attempt<20;attempt++){
        const response=await loadAvatarPage(centerId,{limit:100,search:"",rules:[],cursor},ctl.signal);
        const found=response.records.find(v=>v.id===target);
        if(found){if(!ctl.signal.aborted)setDrawer(found);return;}
        if(!response.nextCursor)break;
        if(seen.has(response.nextCursor))break;
        seen.add(response.nextCursor);cursor=response.nextCursor;
      }
      if(!ctl.signal.aborted)setError("Bản ghi không tồn tại hoặc không có quyền xem tại Center này.");
    })().catch(cause=>{if(!ctl.signal.aborted)setError(dateSafeError(cause));});
    return ()=>ctl.abort();
  },[ready,loadState,centerId,rows,drawer?.id,detail?.id]);

  const switchToDetail=()=>{
    if(!drawer)return;
    setDetail(drawer);setDrawer(null);window.history.replaceState(null,"",recordHref(drawer.id));
  };
  const refreshAfterWrite=()=>setRefresh(v=>v+1);
  const canCreate=grants.has("pinoria.self.create");
  return <>
    {detail ? <AvatarDetail record={detail} centerId={centerId} grants={grants} onBack={exitDetail}
      onSaved={refreshAfterWrite}/> :
    <section id="list-screen" data-avatar-native-dsa="PAP-1810">
      <div className="page-heading">
        <div className="page-heading-left">{menu}<h1>Pinoria Avatar</h1></div>
        <div className="heading-actions">
          {canCreate&&<BoActionButton type="button" variant="primary" onClick={()=>{setNotice("");setCreating(true);}}>＋ Tạo Avatar</BoActionButton>}
        </div>
      </div>
      {notice&&<p role="status">{notice}</p>}
      {error&&<p role="alert">{error} <button type="button" onClick={()=>setRefresh(v=>v+1)}>Thử lại</button></p>}
      {!ready ? <p role="status">Đang xác minh quyền tại Center…</p> :
      <BoDataTable module={avatarModule} rows={rows} loadState={loadState==="error"?error||"Không thể tải dữ liệu":loadState}
        value={table} update={update} page={page} setPage={setPage} nativeAvatarOpener
        policy={tablePolicy} serverTotal={serverTotal} selected={drawer?.id}
        onOpen={onOpen} onSettings={setSettings} filterOpen={filterOpen} setFilterOpen={setFilterOpen}
        views={views} changeViews={setViews} activeView={activeView}
        applyView={view=>{
          if(view){setTable(view.state);setActiveView(view.id);}else{setTable(initialTable());setActiveView(null);}
          setPage(1);cursors.current=new Map([[1,null]]);
        }} reset={reset} undo={()=>{}} canUndo={false}/>}
    </section>}
    {drawer&&!detail&&<AvatarDrawer record={drawer} onClose={closeDrawer} onDetail={switchToDetail}/>}
    {creating&&canCreate&&<CreateSelfDrawer centerId={centerId} onClose={()=>setCreating(false)}
      onCreated={()=>{setCreating(false);setNotice("Đã tạo Avatar.");setPage(1);cursors.current=new Map([[1,null]]);refreshAfterWrite();}}/>}
    {settings&&<BoTableSettings screen={settings} setScreen={setSettings} onClose={()=>setSettings(null)}
      fields={avatarModule.fields} rows={rows} value={table} update={update} views={views} setViews={setViews}
      applyView={view=>{setTable(view.state);setActiveView(view.id);setPage(1);cursors.current=new Map([[1,null]]);}}/>}
  </>;
}
