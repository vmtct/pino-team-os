"use client";
/** PAP-1334 / PAP-1491 SPEC-UNLOCK — authenticated, read-only native PINO DSA.
 * The unscoped legacy Subscription workspace and every writer remain retired.
 */
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useCallback,useContext,useEffect,useRef,useState} from "react";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {BoTableSettings,type BoSavedView} from "@/app/bo/components/registration/BoTableSettings";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {BoApplicationShellContext} from "@/app/bo/shell/BoApplicationShellContext";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {defaultTable,type BoRecord,type BoTableState} from "@/lib/bo-registration";
import type {OwnedSubscriptionItem} from "@/lib/pap1334-native-subscription-read";
import {readSubscriptionCenterDetail} from "@/lib/bo-subscription-center-detail-client";
import {assertCenterDetail,loadCenterSubscriptionDirectory,nativeSubscriptionModule,
  subscriptionRecord,subscriptionUuid} from "@/lib/pap1334-native-subscription-read";

const initial=():BoTableState=>({...defaultTable(nativeSubscriptionModule.fields),pageSize:15});
const detailSections=[
  {id:"service",label:"Thông tin gói học",fields:["name","path","status","start","end","weeklyCommitment","effectiveAvailableUnits"]},
  {id:"history",label:"Lịch sử",fields:["createdAt","createdBy","updatedAt","updatedBy","commercialReference"]},
] as const;

function scopedHref(record:string|null):string {
  const url=new URL(window.location.href);
  if(record)url.searchParams.set("record",record);
  else url.searchParams.delete("record");
  return url.pathname+url.search+url.hash;
}
function failure(error:unknown):string {
  return error instanceof Error ? error.message : "Không thể đọc gói học từ Core.";
}
type Attested={row:BoRecord;id:string};

export function SubscriptionDirectoryDsa(){
  const center=useBoCenterSelection();
  const menu=useContext(BoApplicationShellContext);
  const selected=center&&!center.loading&&!center.error?center.selected:"";
  const previousCenter=useRef<string|null>(null);
  useEffect(()=>{
    if(!selected)return;
    if(previousCenter.current && previousCenter.current!==selected){
      // Clear the previous Center deep-link before the newly scoped list resolves.
      const url=new URL(window.location.href);
      if(url.searchParams.has("record")){
        url.searchParams.delete("record");
        window.history.replaceState(null,"",url.pathname+url.search+url.hash);
      }
    }
    previousCenter.current=selected;
  },[selected]);
  return <section id="subscription-center-read-only-root" data-bo-runtime-surface="subscription-center-read-only" aria-label="Gói học theo cơ sở" data-pap1334-native-subscriptions="read-only">
    {!center?<p role="alert">Không tìm thấy Center context.</p>:
      center.loading?<p role="status">Đang xác thực danh sách cơ sở…</p>:
      center.error?<p role="alert">{center.error}</p>:
      !selected?<p role="status">Chọn cơ sở được cấp quyền để xem gói học.</p>:
      <ScopedSubscriptions key={selected+":"+center.source} centerId={selected}
        centerName={center.centers.find(item=>item.id===selected)?.displayName}
        menu={menu?.("menu-btn")}/>}
  </section>;
}

function ScopedSubscriptions({centerId,centerName,menu}:{
  centerId:string;centerName?:string;menu?:React.ReactNode;
}){
  const [table,setTable]=useState<BoTableState>(initial);
  const [items,setItems]=useState<OwnedSubscriptionItem[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [drawer,setDrawer]=useState<Attested|null>(null);
  const [detail,setDetail]=useState<Attested|null>(null);
  const [revision,setRevision]=useState(0);
  const [page,setPage]=useState(1);
  const [settings,setSettings]=useState<string|null>(null);
  const [filterOpen,setFilterOpen]=useState(false);
  const [views,setViews]=useState<BoSavedView[]>([]);
  const [activeView,setActiveView]=useState<string|null>(null);
  const deepLinkChecked=useRef(false);
  const detailController=useRef<AbortController|null>(null);
  const invoker=useRef<HTMLElement|null>(null);
  const [notice,setNotice]=useState("");

  const changeTable=useCallback((patch:Partial<BoTableState>)=>{
    setTable(current=>({...current,...patch}));setPage(1);setActiveView(null);
  },[]);
  useEffect(()=>{
    const ctl=new AbortController();
    deepLinkChecked.current=false;
    queueMicrotask(()=>{if(!ctl.signal.aborted){setStatus("loading");setError("");}});
    void loadCenterSubscriptionDirectory(centerId,ctl.signal).then(data=>{
      if(ctl.signal.aborted)return;
      setItems(data);setStatus("ready");setError("");
    }).catch(cause=>{
      if(ctl.signal.aborted)return;
      setItems([]);setStatus("error");setError(failure(cause));
    });
    return()=>{ctl.abort();detailController.current?.abort();};
  },[centerId,revision]);

  const verify=useCallback(async(item:OwnedSubscriptionItem,pushUrl:boolean)=>{
    detailController.current?.abort();
    const ctl=new AbortController();detailController.current=ctl;
    setBusy(item.id);setError("");
    try{
      const canonical=assertCenterDetail(
        await readSubscriptionCenterDetail(item.id,centerId,ctl.signal),item.id,centerId,item);
      if(ctl.signal.aborted)return;
      const row:BoRecord={...subscriptionRecord(item),
        path:canonical.pathDisplayName,
        status:canonical.lifecycle,
        start:canonical.serviceStartsOn||"",
        end:canonical.contractualEndsOn||"",
        weeklyCommitment:canonical.weeklyCommitment,
        effectiveAvailableUnits:canonical.effectiveAvailableUnits,
        commercialReference:canonical.commercialReference||"",
        centerId:canonical.centerId,
      };
      setDetail(null);setDrawer({id:item.id,row});setNotice("");
      if(pushUrl)window.history.pushState(null,"",scopedHref(item.id));
    }catch(cause){
      if(!ctl.signal.aborted){setError(failure(cause));setDrawer(null);setDetail(null);}
    }finally{if(!ctl.signal.aborted)setBusy(null);}
  },[centerId]);

  useEffect(()=>{
    if(status!=="ready"||deepLinkChecked.current)return;
    deepLinkChecked.current=true;
    const record=new URL(window.location.href).searchParams.get("record");
    if(!record)return;
    const matching=items.find(item=>item.id===record);
    if(!subscriptionUuid.test(record)||!matching){
      queueMicrotask(()=>setError("Gói học không thuộc cơ sở được cấp quyền hoặc không tồn tại."));
      return;
    }
    queueMicrotask(()=>void verify(matching,false));
  },[status,items,verify]);

  useEffect(()=>{
    const onBack=()=>{
      const record=new URL(window.location.href).searchParams.get("record");
      if(!record){detailController.current?.abort();setDrawer(null);setDetail(null);setBusy(null);}
    };
    window.addEventListener("popstate",onBack);
    return()=>window.removeEventListener("popstate",onBack);
  },[]);
  const rows=items.map(subscriptionRecord);
  const close=()=>{
    detailController.current?.abort();
    setDetail(null);setDrawer(null);setBusy(null);
    window.history.replaceState(null,"",scopedHref(null));
    requestAnimationFrame(()=>invoker.current?.focus({preventScroll:true}));
  };
  const open=(row:BoRecord)=>{
    invoker.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const item=items.find(item=>item.id===row.id);
    if(!item){setError("Gói học không nằm trong danh sách cơ sở đã chọn.");return;}
    void verify(item,true);
  };
  const selected=detail??drawer;

  return <>
    {detail ? <DetailFrame title={detail.row.name} subtitle={String(detail.row.path||"Gói học")}
      mobileMenu={menu} onBack={close}
      legacyContent={<PropertySections variant="detail" record={detail.row}
        fields={nativeSubscriptionModule.fields} sections={detailSections}
        canEdit={()=>false}/>}>{null}</DetailFrame> :
      <section id="list-screen">
        <div className="page-heading">
          <div className="page-heading-left">{menu}<h1>Gói học</h1></div>
          <div className="heading-actions"><span role="status">Chỉ xem · {centerName||"Cơ sở đã chọn"}</span></div>
        </div>
        {error?<p role="alert">{error} <button type="button" className="secondary-btn"
          onClick={()=>{detailController.current?.abort();setDrawer(null);setRevision(n=>n+1);}}>
          Thử lại</button></p>:null}
        {busy?<p role="status">Đang xác thực Subscription thuộc cơ sở…</p>:null}
        {notice?<p role="status">{notice}</p>:null}
        <BoDataTable module={nativeSubscriptionModule} rows={rows} loadState={status}
          value={table} update={changeTable} page={page} setPage={setPage}
          onOpen={open} selected={selected?.id} onSettings={setSettings}
          filterOpen={filterOpen} setFilterOpen={setFilterOpen} views={views}
          changeViews={setViews} activeView={activeView}
          applyView={value=>{setTable(value?.state??initial());setActiveView(value?.id??null);setPage(1);}}
          reset={()=>{setTable(initial());setActiveView(null);setPage(1);}}
          undo={()=>{}} canUndo={false}/>
      </section>}
    {drawer&&!detail?<BoQuickView module={nativeSubscriptionModule} moduleKey="subscriptions"
      record={drawer.row} onClose={close}
      onDetail={()=>{setDetail(drawer);setDrawer(null);}}/>:null}
    {settings?<BoTableSettings screen={settings} setScreen={setSettings}
      onClose={()=>setSettings(null)} fields={nativeSubscriptionModule.fields}
      rows={rows} value={table} update={changeTable} views={views} setViews={setViews}
      applyView={value=>{setTable(value.state);setActiveView(value.id);setPage(1);}}/>:null}
  </>;
}
