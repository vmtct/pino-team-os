"use client";
import {openingReviewActorLabel} from "@/lib/opening-review-actor-label";
import {openingEvidencePageHref} from "@/lib/opening-evidence-page-route";
import {useRouter} from "next/navigation";
import {useContext,useEffect,useState} from "react";
import {OpeningEvidenceDrawerGallery} from "./OpeningEvidenceGallery";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoTableSettings} from "@/app/bo/components/registration/BoTableSettings";
import {BoApplicationShellContext} from "@/app/bo/shell/BoApplicationShellContext";
import {defaultTable,type BoModule,type BoRecord,type BoTableState} from "@/lib/bo-registration";
import type {TablePolicy} from "@/app/components/workspace-renderer/TablePolicy";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {openingEvidenceApi,type OpeningEvidenceRow,type EvidenceStatus,type SubjectType} from "@/lib/bo-opening-evidence-api";

export const statusLabels:Record<EvidenceStatus,string>={PENDING:"Chờ duyệt",APPROVED:"Đã duyệt",REJECTED:"Từ chối"};
export const subjectLabels:Record<SubjectType,string>={CLASS:"Lớp học",RECEPTION:"Tiếp tân"};
export function evidenceTime(value:string):string{
  const time=new Date(value);
  return Number.isFinite(time.getTime())?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(time):"—";
}
export function evidenceProperties(r:OpeningEvidenceRow){
  return [
    ["Loại",subjectLabels[r.subjectType]],["Lớp / Ca",r.subjectLabel],["Ngày",r.workDate],
    ["Mở lúc",evidenceTime(r.openedAt)],["Submitted By",r.submittedByLegalFullName??"—"],["Trạng thái",statusLabels[r.status]],
    ["Created Time",evidenceTime(r.openedAt)],["Created By","Hệ thống"],["Last Modified Time",evidenceTime(r.lastModifiedAt)],
    ["Last Modified By",openingReviewActorLabel(r.lastModifiedByLegalFullName,r.lastModifiedReviewAccountRecorded)],
  ].map(([label,value])=>({key:label!,label:label!,value}));
}
const openingModule:BoModule={label:"Mở lớp và ca",group:"SCHOOL",fields:[
  {key:"name",label:"Lớp / Ca",type:"text",icon:"Aa",w:200,readonly:true},
  {key:"subjectType",label:"Loại",type:"select",icon:"▾",w:120,readonly:true},
  {key:"workDate",label:"Ngày",type:"date",icon:"▦",w:120,readonly:true},
  {key:"submittedBy",label:"Submitted By",type:"person",icon:"Aa",w:175,readonly:true},
  {key:"status",label:"Trạng thái",type:"select",icon:"▾",w:130,readonly:true},
  {key:"createdAt",label:"Created Time",type:"datetime",icon:"▦",w:170,readonly:true},
  {key:"createdBy",label:"Created By",type:"text",icon:"Aa",w:130,readonly:true},
  {key:"updatedAt",label:"Last Modified Time",type:"datetime",icon:"▦",w:170,readonly:true},
  {key:"updatedBy",label:"Last Modified By",type:"text",icon:"Aa",w:200,readonly:true},
]};
const initial=():BoTableState=>({...defaultTable(openingModule.fields),pageSize:15});
// Core currently admits selected-Center / status / type / date / search, not arbitrary sort/group/rules.
const policy:TablePolicy={identity:"name",search:["name","submittedBy"],filter:[],sort:[],group:[],edit:[],viewActions:[]};
const rowKey=(r:OpeningEvidenceRow)=>r.subjectType+":"+r.openingReceiptId;
const tableRow=(r:OpeningEvidenceRow):BoRecord=>({id:rowKey(r),name:r.subjectLabel,subjectType:subjectLabels[r.subjectType],workDate:r.workDate,submittedBy:r.submittedByLegalFullName??"—",status:statusLabels[r.status],createdAt:r.openedAt,createdBy:"Hệ thống",updatedAt:r.lastModifiedAt,updatedBy:openingReviewActorLabel(r.lastModifiedByLegalFullName,r.lastModifiedReviewAccountRecorded)});
export const detailHref=openingEvidencePageHref;
export function OpeningEvidenceStageGate(){
  const scope=useBoCenterSelection();
  const allowed=Boolean(scope&&!scope.loading&&!scope.error&&scope.selected&&scope.centers.some(center=>center.id===scope.selected));
  return <ScopeView key={JSON.stringify([scope?.selected,allowed])} centerId={scope?.selected??""} allowed={allowed} loading={!scope||scope.loading}/>;
}
function ScopeView({centerId,allowed,loading}:{centerId:string;allowed:boolean;loading:boolean}){
  const menu=useContext(BoApplicationShellContext),router=useRouter();
  const [status,setStatus]=useState<EvidenceStatus|"ALL">("PENDING");
  const [type,setType]=useState<SubjectType|"ALL">("ALL");
  const [table,setTable]=useState<BoTableState>(initial),[page,setPage]=useState(1);
  const [startDate,setStartDate]=useState(""),[endDate,setEndDate]=useState("");
  const [settings,setSettings]=useState<string|null>(null),[filterOpen,setFilterOpen]=useState(false);
  const [retry,setRetry]=useState(0);
  const validRange=!startDate||!endDate||startDate<=endDate;
  const [selected,setSelected]=useState<string|null>(null);
  const [response,setResponse]=useState<{key:string;rows:OpeningEvidenceRow[];total:number;error:string}|null>(null);
  const search=table.search,limit=table.pageSize,offset=(page-1)*limit;
  const key=JSON.stringify([centerId,status,type,search,offset,limit,startDate,endDate,retry]);
  useEffect(()=>{
    if(!allowed||!validRange)return;
    const controller=new AbortController();
    void openingEvidenceApi.list({centerId,offset,limit,...(status!=="ALL"?{status}:{}),...(type!=="ALL"?{subjectType:type}:{}),
      ...(search.trim()?{search:search.trim()}:{}),...(startDate?{startDate}:{}),...(endDate?{endDate}:{})},controller.signal).then(result=>{
      if(!controller.signal.aborted)setResponse({key,...result,error:""});
    }).catch(error=>{if(!controller.signal.aborted)setResponse({key,rows:[],total:0,error:error instanceof Error?error.message:"Không thể tải Core."});});
    return()=>controller.abort();
  },[allowed,centerId,key,status,type,search,offset,limit,startDate,endDate,validRange]);
  const current=allowed&&validRange&&response?.key===key?response:null;
  const row=current?.rows.find(r=>rowKey(r)===selected);
  const rows=(current?.rows??[]).map(tableRow);
  const resetPage=()=>{setPage(1);setSelected(null);};
  const update=(patch:Partial<BoTableState>)=>{
    // The native column controller owns presentation only. Filter and paging stay in the admitted Core contract.
    setTable(old=>({...old,...patch,rules:[],sort:"",desc:false,group:"",collapsed:[],hiddenGroups:[]}));
    if(patch.search!==undefined||patch.pageSize!==undefined)resetPage();
  };
  const changeStatus=(s:EvidenceStatus|"ALL")=>{setStatus(s);resetPage();};
  const reset=()=>{setTable(initial());setType("ALL");setStartDate("");setEndDate("");resetPage();};
  const builtIn=<>{(["PENDING","APPROVED","REJECTED"] as const).map(s=><button key={s} type="button" role="tab" aria-selected={status===s} aria-controls="table-scroll" tabIndex={status===s?0:-1} className={"view-tab "+(status===s?"active":"")} onClick={()=>changeStatus(s)}>{statusLabels[s]}</button>)}</>;
  const filters=<div className="rules-panel" aria-label="Bộ lọc mở lớp và ca">
    <label className="settings-line"><span>Loại</span><select className="rule-value-input" aria-label="Loại mở" value={type} onChange={e=>{setType(e.target.value as SubjectType|"ALL");resetPage();}}>
      <option value="ALL">Tất cả loại</option><option value="CLASS">Lớp học</option><option value="RECEPTION">Tiếp tân</option>
    </select></label>
    <label className="settings-line"><span>Từ ngày</span><input className="rule-value-input" type="date" aria-label="Từ ngày" value={startDate} max={endDate||undefined} onChange={e=>{setStartDate(e.target.value);resetPage();}}/></label>
    <label className="settings-line"><span>Đến ngày</span><input className="rule-value-input" type="date" aria-label="Đến ngày" value={endDate} min={startDate||undefined} onChange={e=>{setEndDate(e.target.value);resetPage();}}/></label>
  </div>;
  return <section aria-label="Mở lớp và ca" data-opening-evidence-phase="NATIVE_STAGING_CANDIDATE" data-opening-native-dsa="">
    <section id="list-screen" data-tdd-shell="table" data-tdd-freeze-controls="" data-tdd-surface="BO">
      <div className="page-heading"><div className="page-heading-left">{menu?.("menu-btn")}<h1>Mở lớp &amp; ca</h1></div></div>
      {loading?<p role="status">Đang xác thực cơ sở…</p>:!allowed?<p role="alert">Chọn cơ sở được cấp quyền.</p>:<>
        {!validRange?<p role="alert">Khoảng ngày không hợp lệ.</p>:current?.error?<p role="alert">{current.error} <button type="button" onClick={()=>setRetry(v=>v+1)}>Thử lại</button></p>:null}
        <BoDataTable module={openingModule} rows={rows} loadState={!validRange||current?.error?"Không thể tải dữ liệu.":current?"ready":"loading"}
          value={table} update={update} page={page} setPage={p=>{setPage(p);setSelected(null);}} serverTotal={current?.total??0}
          onOpen={r=>setSelected(r.id)} selected={selected??undefined} builtInViews={builtIn} minimal policy={policy}
          onSettings={setSettings} filterOpen={filterOpen} filterContent={filters} setFilterOpen={setFilterOpen}
          views={[]} changeViews={()=>{}} activeView={status==="ALL"?null:status} applyView={()=>changeStatus("ALL")}
          reset={reset} undo={()=>{}} canUndo={false} freezeEnabled/>
      </>}
    </section>
    {row?<BoQuickView module={{...openingModule,fields:[...openingModule.fields.slice(0,3),{key:"openedAt",label:"Mở lúc",type:"datetime",icon:"▦",w:170,readonly:true},...openingModule.fields.slice(3)]}} moduleKey="opening-evidence"
      record={{...tableRow(row),openedAt:row.openedAt}} onClose={()=>setSelected(null)}
      onDetail={()=>{setSelected(null);router.push(detailHref(row));}}
      extraSection={<OpeningEvidenceDrawerGallery row={row} formatTime={evidenceTime}/>}/>:null}
    {settings&&allowed?<BoTableSettings screen={settings} setScreen={screen=>setSettings(screen==="properties"?screen:null)} onClose={()=>setSettings(null)} fields={openingModule.fields}
      rows={rows} value={table} update={update} views={[]} setViews={()=>{}} applyView={()=>{}} policy={policy}/>:null}
  </section>;
}
