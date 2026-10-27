"use client";
import {useEffect,useRef,useState} from "react";
import {BoDataTable} from "./BoDataTable";
import {useBoDialog} from "./useBoDialog";
import {defaultTable,type BoModule,type BoRecord} from "@/lib/bo-registration";
import {centerBusinessDate,displayLocalDate,enrollmentDisplayEndDate,enrollmentPeriodState} from "@/lib/bo-class-enrollment-presenter";

type Item={
  id:string;runningClassId:string;subscriptionId:string;studentProfileId:string;
  studentDisplayName:string;effectiveFromLocalDate:string;effectiveUntilExclusiveLocalDate:string|null;
};
type Cursor={effectiveFromLocalDate:string;id:string};
type Page={items:Item[];limit:number;nextCursor:Cursor|null};
const studentColumns:BoModule={label:"Học viên trong lớp",group:"SCHOOL",fields:[
  {key:"name",label:"Học viên",type:"text",icon:"Aa",w:255,readonly:true},
  {key:"start",label:"Ngày bắt đầu",type:"text",icon:"▦",w:175,readonly:true},
  {key:"end",label:"Ngày kết thúc",type:"text",icon:"▦",w:175,readonly:true},
  {key:"status",label:"Tình trạng",type:"select",icon:"▣",w:155,readonly:true}
]};
function errorMessage(status:number){
  return status===401?"Phiên đăng nhập đã hết hạn.":status===403?"Bạn không có quyền xem học viên trong lớp.":status===404?"Chưa có API Enrollment theo lớp trên Core Staging.":"Không thể tải học viên của lớp.";
}
async function getPage(classId:string,cursor:Cursor|null,signal:AbortSignal):Promise<Page>{
  const query=new URLSearchParams({limit:"50"});
  if(cursor){query.set("beforeFrom",cursor.effectiveFromLocalDate);query.set("beforeId",cursor.id);}
  const r=await fetch("/api/bo/delivery/running-classes/"+encodeURIComponent(classId)+"/enrollments?"+query.toString(),{cache:"no-store",credentials:"same-origin",signal});
  if(!r.ok)throw new Error(errorMessage(r.status));
  const parsed=await r.json() as {data?:Page};
  const data=parsed.data;
  if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.limit)||data.limit<1||data.limit>100||
    !Object.hasOwn(data,"nextCursor")||data.items.some(item=>item.runningClassId!==classId||
      typeof item.id!=="string"||typeof item.studentProfileId!=="string"||typeof item.studentDisplayName!=="string"||
      typeof item.effectiveFromLocalDate!=="string"||
      !(item.effectiveUntilExclusiveLocalDate===null||typeof item.effectiveUntilExclusiveLocalDate==="string"))||
    (data.nextCursor!==null&&(!data.nextCursor||typeof data.nextCursor.effectiveFromLocalDate!=="string"||typeof data.nextCursor.id!=="string")))
    throw new Error("Dữ liệu Enrollment từ Core không hợp lệ.");
  return data;
}
export function BoRunningClassEnrollment({runningClassId,centerTimeZone}:{runningClassId:string;centerTimeZone:string|null}){
  const [items,setItems]=useState<Item[]>([]);
  const [cursor,setCursor]=useState<Cursor|null>(null);
  const [phase,setPhase]=useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(0);
  const [selected,setSelected]=useState<Item|null>(null);
  const [table,setTable]=useState(()=>defaultTable(studentColumns.fields));
  const [page,setPage]=useState(1);
  const abort=useRef<AbortController|null>(null);
  const timezoneDate=centerBusinessDate(centerTimeZone);
  useEffect(()=>{
    const controller=new AbortController();
    abort.current?.abort();abort.current=controller;
    setItems([]);setCursor(null);setPhase("loading");setError("");setPage(1);
    void getPage(runningClassId,null,controller.signal).then(data=>{
      if(controller.signal.aborted)return;
      setItems(data.items);setCursor(data.nextCursor);setPhase("ready");
    }).catch(caught=>{
      if(controller.signal.aborted)return;
      setError(caught instanceof Error?caught.message:"Không thể tải Enrollment.");setPhase("error");
    });
    return ()=>controller.abort();
  },[runningClassId,retry]);
  async function loadMore(){
    if(!cursor||busy)return;
    const controller=new AbortController();abort.current=controller;setBusy(true);setError("");
    try{
      const data=await getPage(runningClassId,cursor,controller.signal);
      if(controller.signal.aborted)return;
      setItems(old=>[...old,...data.items.filter(item=>!old.some(prev=>prev.id===item.id))]);
      setCursor(data.nextCursor);
    }catch(caught){
      if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:"Không thể tải trang tiếp.");
    }finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const ordered=[...items].sort((a,b)=>enrollmentPeriodState(a,timezoneDate).priority-enrollmentPeriodState(b,timezoneDate).priority||
    b.effectiveFromLocalDate.localeCompare(a.effectiveFromLocalDate)||a.id.localeCompare(b.id));
  const rows:BoRecord[]=ordered.map(item=>({
    id:item.id,name:item.studentDisplayName+" · "+item.studentProfileId,
    start:displayLocalDate(item.effectiveFromLocalDate),
    end:enrollmentDisplayEndDate(item.effectiveUntilExclusiveLocalDate),
    status:enrollmentPeriodState(item,timezoneDate).label
  }));
  return <section className="property-section" aria-label="Học viên trong lớp">
    <h3>Học viên trong lớp <span className="table-meta">{new Set(items.map(item=>item.studentProfileId)).size} học viên</span></h3>
    {error?<p role="alert" className="edit-error">{error}</p>:null}
    {phase==="error"?<button type="button" className="secondary-btn" onClick={()=>setRetry(n=>n+1)}>Thử lại</button>:null}
    <BoDataTable module={studentColumns} rows={rows} loadState={phase==="error"?error:phase}
      value={table} update={patch=>{setTable(current=>({...current,...patch}));setPage(1);}}
      page={page} setPage={setPage} onOpen={row=>setSelected(items.find(item=>item.id===row.id)??null)}
      onSettings={()=>{}} filterOpen={false} setFilterOpen={()=>{}} views={[]} changeViews={()=>{}}
      activeView={null} applyView={()=>{}} reset={()=>setTable(defaultTable(studentColumns.fields))}
      undo={()=>{}} canUndo={false} minimal showChrome={false} />
    {phase==="ready"&&cursor?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>void loadMore()}>{busy?"Đang tải…":"Tải thêm học viên"}</button>:null}
    <p className="settings-hint">Ngày kết thúc là ngày cuối học viên thuộc lớp. “—” nghĩa là chưa có ngày kết thúc.</p>
    {selected?<EnrollmentStudentQuickView item={selected} today={timezoneDate} onClose={()=>setSelected(null)}/>:null}
  </section>;
}
function EnrollmentStudentQuickView({item,today,onClose}:{item:Item;today:string|null;onClose:()=>void}){
  const panel=useRef<HTMLElement>(null);
  useBoDialog(true,onClose,panel);
  const [guardians,setGuardians]=useState<string[]|null>(null);
  const [guardianError,setGuardianError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/bo/students/"+encodeURIComponent(item.studentProfileId)+"/lifecycle",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error(errorMessage(r.status));return r.json();})
      .then(payload=>{
        if(controller.signal.aborted)return;
        const raw=(payload as {data?:{guardians?:Array<{parent?:{displayName?:string|null}}>} }).data?.guardians;
        setGuardians(Array.isArray(raw)?raw.map(g=>g.parent?.displayName).filter((v):v is string=>typeof v==="string"):[]);
      }).catch(()=>{if(!controller.signal.aborted)setGuardianError("Không có quyền hoặc chưa có thông tin.");});
    return ()=>controller.abort();
  },[item.studentProfileId]);
  const prop=(label:string,value:string)=><div className="property-row" key={label}><div className="property-label">{label}</div><div className="property-control">{value}</div></div>;
  return <><div className="drawer-scrim visible" aria-hidden="true" onClick={onClose}/>
    <aside id="drawer" ref={panel} className="drawer open" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-top"><div className="drawer-header-copy"><span className="drawer-path">Running Classes · Enrollment</span><h2 id="drawer-title" className="drawer-record-title">{item.studentDisplayName}</h2></div><button type="button" className="drawer-close" onClick={onClose} aria-label="Đóng">×</button></div>
      <div className="drawer-content"><section className="property-section"><h3>Học viên</h3>
        {prop("Họ và tên",item.studentDisplayName)}{prop("Mã học viên",item.studentProfileId)}
        {prop("Phụ huynh",guardians?guardians.join(", ")||"Chưa có thông tin":guardianError||"Đang tải…")}
      </section><section className="property-section"><h3>Thông tin trong lớp</h3>
        {prop("Ngày bắt đầu",displayLocalDate(item.effectiveFromLocalDate))}
        {prop("Ngày kết thúc",enrollmentDisplayEndDate(item.effectiveUntilExclusiveLocalDate))}
        {prop("Tình trạng",enrollmentPeriodState(item,today).label)}
        {prop("Enrollment ID",item.id)}{prop("Subscription ID",item.subscriptionId)}
      </section></div><div className="drawer-footer"><div className="lab-bottom"><button type="button" className="secondary-btn" onClick={onClose}>Đóng</button></div></div>
    </aside></>;
}
