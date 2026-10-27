"use client";
/**
 * PAP-938 integration workstation. Isolated worktree ONLY: not a production route.
 * Actual /api/workforce and /api/tos-learning reads; no mutation/fake successful state.
 */
import {useEffect,useMemo,useState} from "react";
import {workforceApi,type WorkforceContext} from "@/lib/workforce-api";
import {TosVNextShift} from "@/app/components/tos-vnext/TosVNextShift";
import frameLayout from "@/app/components/tos-ds/phone-frame.module.css";
import {TosVNextHome} from "@/app/components/tos-vnext/TosVNextHome";
import {TosVNextTraining} from "@/app/components/tos-vnext/TosVNextTraining";
import {TosVNextClassroom} from "@/app/components/tos-vnext/TosVNextClassroom";
import {TosVNextReception} from "@/app/components/tos-vnext/TosVNextReception";
import {TosVNextStation} from "@/app/components/tos-vnext/TosVNextStation";
import {TosVNextShiftLead} from "@/app/components/tos-vnext/TosVNextShiftLead";
import {resolveTosAppAccess} from "@/lib/tos-app-access";
import {canOpenVNextApp} from "@/lib/tos-vnext-active-access";
import {nextConfirmedAssignment} from "@/lib/tos-vnext-next-assignment";
import {
 TosVNextFrame,TosVNextAppHeader,TosVNextContent,
 TosVNextCard,
 type TosVNextAppId
} from "@/app/components/tos-ds";
import {
 staffContext,assertOwnCenter,shiftReadModel,type TosVNextShiftReadWarnings
} from "@/app/components/tos-vnext/core-adapters";
import type {Assignment,TimekeepingSession} from "@/lib/workforce-api";
import type {OwnIncomePage} from "@/lib/tos-own-income-api";



type Section="home"|TosVNextAppId;
type ShiftData={assignments:Assignment[];current:TimekeepingSession|null;history:TimekeepingSession[]|null;income:OwnIncomePage|null;warnings:TosVNextShiftReadWarnings};
type FounderAssignment=Assignment&{staffMemberId:string;staffLabel:string};
type FounderVisits={centerId:string;data:Array<{id:string;student:{id:string;displayName:string};status:"OPEN"|"CLOSED";checkedInAt:string;checkedOutAt:string|null}>;total:number;summary:{totalVisits:number;openVisits:number;closedVisits:number}};
type ReadData={shift?:ShiftData;founder?:{centerId:string;assignments:FounderAssignment[];truncated:boolean};visits?:FounderVisits};
function today(timeZone:string,offsetDays=0){
 const date=new Date(Date.now()+offsetDays*86400000);
 return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
export default function TosVNextIntegrationPreview(){
 const [ctx,setCtx]=useState<WorkforceContext|null>(null);
 const [profileLabel,setProfileLabel]=useState<string|null>(null);
 const [homeNotice,setHomeNotice]=useState("");
 const [centerId,setCenterId]=useState("");
 const [app,setApp]=useState<Section>("home");
 const [classDetailOpen,setClassDetailOpen]=useState(false);
 const [data,setData]=useState<ReadData>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [desktop,setDesktop]=useState(false);
 const [clockNow,setClockNow]=useState(()=>new Date());
 const [scheduleRefresh,setScheduleRefresh]=useState(0);
 useEffect(()=>{if(!homeNotice)return;const timer=setTimeout(()=>setHomeNotice(""),2700);return()=>clearTimeout(timer)},[homeNotice]);
 useEffect(()=>{
  const refresh=()=>setClockNow(new Date());
  const interval=window.setInterval(refresh,60_000);
  const onVisible=()=>{if(document.visibilityState==="visible"){refresh();setScheduleRefresh(n=>n+1)}};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{window.clearInterval(interval);document.removeEventListener("visibilitychange",onVisible)};
 },[]);
 const center=ctx?.centers.find(c=>c.id===centerId);
 const zone=center?.timeZone||"Asia/Ho_Chi_Minh";
 const fromDate=today(zone);
 const access=useMemo(()=>{
  if(!ctx||!centerId)return null;
  // Existing resolver enforces local role presentation. API endpoints MUST independently enforce server authority.
  return resolveTosAppAccess({assignments:data.shift?.assignments??[],centerId,
   nowLocal:fromDate+"T"+new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(clockNow),
   desktop,scheduleReady:!!data.shift});
 },[ctx,centerId,data.shift,desktop,zone,fromDate,clockNow]);
 // Do not leave privileged app content mounted after the shift window ends,
 // the center changes, or the station shrinks below desktop size.
 useEffect(()=>{
  if(app==="home"||loading||ctx?.founderMode)return;
  if(!ctx||!centerId||!data.shift){setApp("home");setClassDetailOpen(false);return}
  const denied=!canOpenVNextApp(app,{authenticated:!!ctx,centerReady:!!centerId,
   scheduleReady:!!data.shift,desktop,access});
  if(denied){setApp("home");setClassDetailOpen(false);setHomeNotice("Ca này bạn chưa có quyền.");}
 },[app,loading,ctx,centerId,data.shift,access,desktop]);
 useEffect(()=>{
  const media=window.matchMedia("(min-width:1024px)");
  const fn=()=>setDesktop(media.matches);fn();media.addEventListener("change",fn);
  let valid=true;
  void workforceApi.profile().then(value=>{if(valid)setProfileLabel(value.data.displayLabel)}).catch(()=>{});
  void staffContext().then(value=>{
   if(!valid)return;setCtx(value);setCenterId(value.centers[0]?.id||"");if(!value.centers.length)setError("Tài khoản không có trung tâm được cấp quyền.");
  }).catch(e=>{if(valid)setError(e instanceof Error?e.message:"Không thể xác thực người dùng.")})
   .finally(()=>{if(valid)setLoading(false)});
  return()=>{valid=false;media.removeEventListener("change",fn)};
 },[]);
 useEffect(()=>{
  if(!centerId||!ctx)return;
  // Founder has a Core-authenticated global browse context but no self Staff record.
  // Do not probe Staff-only schedule, payroll, profile or timekeeping endpoints.
  if(ctx.founderMode){
   let active=true;
   setError("");setData({});setLoading(true);
   void Promise.all([
    workforceApi.founderCenterSchedule({centerId,startDate:today(zone),endDate:today(zone,14)}),
    workforceApi.founderCenterVisits({centerId,status:"ALL"})
   ]).then(([schedule,visits])=>{if(active)setData({founder:schedule.data,visits:visits.data})})
    .catch(e=>{if(active)setError(e instanceof Error?e.message:"Không thể tải dữ liệu Center từ Core.")})
    .finally(()=>{if(active)setLoading(false)});
   return()=>{active=false};
  }
  let active=true;
  setError("");setLoading(true);setData({});
  void shiftReadModel(centerId,today(zone).slice(0,8)+"01",today(zone,14)).then(v=>{
   if(active)setData(prev=>({...prev,shift:{assignments:v.assignments,current:v.current,history:v.history,income:v.income,warnings:v.warnings}}));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Không thể tải trạng thái ca.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[centerId,ctx,zone,fromDate,scheduleRefresh]);
 async function choose(next:Section){
  if(next==="home"){setApp("home");return}
  if(!ctx||!centerId||loading){setHomeNotice("Cần xác thực nhân viên và cơ sở trước khi mở ứng dụng.");return}
  if(!canOpenVNextApp(next,{authenticated:!!ctx,centerReady:!!centerId,
   scheduleReady:!!data.shift,desktop,access})){
   setHomeNotice("Ca này bạn chưa có quyền.");return;
  }
  setApp(next);setError("");
 }
 const nowLocalTime=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(clockNow);
 const nextAssignment=nextConfirmedAssignment(data.shift?.assignments??[],centerId,fromDate,nowLocalTime);
 // Render-guard, not only useEffect cleanup: never paint stale privileged app content
 // during a Core schedule revalidation or immediately after role revocation.
 const appRenderable=app!=="home"&&!loading&&canOpenVNextApp(app,{
  authenticated:!!ctx,centerReady:!!centerId,scheduleReady:!!data.shift,desktop,access
 });
 // Founder browsing is authorized by Core's protected GLOBAL role, never by
 // a client-supplied email or StaffMember ID. All panels here are strictly
 // read-only presentations; Staff self actions still fail closed at Core.
 if(ctx?.founderMode){
  const canBrowse=(id:TosVNextAppId)=>id!=="station"||desktop;
  const browseHome=()=> <TosVNextHome founderMode profileLabel="Founder" centerName={center?.displayName}
   authorizedCenters={ctx.centers} selectedCenterId={centerId}
   onCenterChange={id=>{
    try{assertOwnCenter(ctx,id)}catch{setHomeNotice("Cơ sở chưa được cấp quyền.");return}
    setCenterId(id);setApp("home");setHomeNotice("");
   }}
   nextAssignment={null} busy={loading||!centerId}
   allowed={canBrowse}
   onOpen={id=>{if(canBrowse(id)&&centerId)setApp(id);else setHomeNotice("Trạm TOS cần màn hình desktop.")}}
   onNotify={()=>setHomeNotice("Thông báo chưa sẵn sàng.")}
   notice={homeNotice||error}/>;
  if(app==="home"||loading||!centerId||(app==="station"&&!desktop))return browseHome();
  const names:Record<TosVNextAppId,string>={
   shift:"Ca Làm",reception:"Tiếp Tân",station:"Trạm TOS",
   "shift-lead":"Trưởng Ca",classroom:"Lớp Học",training:"Thăng Tiến"
  };
  return <TosVNextFrame app={app} mode={app==="station"?"desktop":"mobile"}>
   <TosVNextAppHeader app={app} station={center?.displayName} onHome={()=>setApp("home")}/>
   <TosVNextContent>
    <TosVNextCard>
     <h2>{names[app]}</h2>
     <p role="status">Chế độ Founder · {center?.displayName||"Chưa chọn trung tâm"}</p>
     {app==="shift"||app==="shift-lead"?<section aria-label="Lịch phân công Center">
      <h3>Phân công thực từ Core · 15 ngày</h3>
      {error&&<p role="alert">{error}</p>}
      {!error&&!data.founder&&<p role="status">Dữ liệu chưa sẵn sàng.</p>}
      {data.founder&&(()=>{
       const rows=data.founder.assignments.filter(row=>app==="shift"||row.roleAssignments?.some(role=>role.roleType==="SHIFT_LEADER"));
       return <><p>{rows.length} phân công được trả về.</p>
        {data.founder.truncated&&<p role="status">Chỉ hiển thị 100 dòng đầu; cần phân trang.</p>}
        {!rows.length&&<p>Không có phân công trong khoảng ngày này.</p>}
        {rows.map(row=><article key={row.id}>
         <strong>{row.staffLabel}</strong>
         <p>{row.workDate} · {row.shift?.displayLabel||"Theo giờ lớp"} · {row.status}</p>
         <p>{row.effectiveStartLocal||row.shift?.startLocalTime||"—"} – {row.effectiveEndLocal||row.shift?.endLocalTime||"—"}</p>
        </article>)}
       </>;
      })()}
     </section>:app==="classroom"?
      <TosVNextClassroom centerId={centerId} localDate={fromDate} profileLabel="Founder" onDetailChange={setClassDetailOpen}/>:
      app==="reception"||app==="station"?<section aria-label="Student Visits Center">
       <h3>Student Visits · Dữ liệu thực từ Core</h3>
       {error&&<p role="alert">{error}</p>}
       {data.visits?<>
        <p>Đang có mặt: {data.visits.summary.openVisits} · Đã về: {data.visits.summary.closedVisits} · Tổng: {data.visits.summary.totalVisits}</p>
        {data.visits.data.length===0&&<p>Không có Student Visit tại Center.</p>}
        {data.visits.data.map(visit=><article key={visit.id}>
          <strong>{visit.student.displayName}</strong>
          <p>{visit.status==="OPEN"?"Đang có mặt":"Đã về"} · {visit.checkedInAt}</p>
          {visit.checkedOutAt&&<p>Ra về: {visit.checkedOutAt}</p>}
         </article>)}
        {data.visits.total>data.visits.data.length&&<p role="status">Chỉ hiển thị 50 visit gần nhất; cần phân trang để xem toàn bộ lịch sử.</p>}
       </>:<p role="status">Chưa tải được Student Visits từ Core.</p>}
      </section>:
      <p>Core chưa có read-model Center-wide được xác minh cho module này; không dùng Staff-self hoặc dữ liệu giả.</p>}
     <p>Để xem và quản lý dữ liệu vận hành của trung tâm, sử dụng Back Office trong khi giao diện giám sát Founder cho ứng dụng này được hoàn thiện.</p>
     <a href="https://bo.staging.pinohouse.art/bo">Mở Back Office</a>
    </TosVNextCard>
   </TosVNextContent>
  </TosVNextFrame>;
 }
 if(!appRenderable)return <TosVNextHome profileLabel={profileLabel} centerName={center?.displayName}
  authorizedCenters={ctx?.centers??[]} selectedCenterId={centerId}
  onCenterChange={id=>{
   if(!ctx)return;
   try{assertOwnCenter(ctx,id)}
   catch{setHomeNotice("Cơ sở chưa được cấp quyền.");return}
   if(id===centerId)return;
   setLoading(true);setData({});setCenterId(id);setHomeNotice("");
  }}
  nextAssignment={nextAssignment} busy={loading||!ctx}
  allowed={id=>canOpenVNextApp(id,{authenticated:!!ctx,centerReady:!!centerId,
   scheduleReady:!!data.shift,desktop,access})}
  onOpen={id=>void choose(id)} onNotify={()=>setHomeNotice("Thông báo chưa sẵn sàng.")}
  notice={homeNotice||error}/>;
 if(app==="station")return <TosVNextFrame app="station" mode="desktop"><TosVNextStation desktop={desktop} centerName={center?.displayName||""} onHome={()=>void choose("home")}/></TosVNextFrame>;
 return <TosVNextFrame app={app} mode="mobile">
  {(app!=="classroom"||!classDetailOpen)&&<TosVNextAppHeader app={app} station={center?.displayName} onHome={()=>void choose("home")}/> }
  {app==="reception"?<TosVNextReception centerId={centerId} centerName={center?.displayName||""} profileLabel={profileLabel||""} workDate={today(zone)} assignments={data.shift?.assignments??[]}/>:app==="training"?<TosVNextTraining/>:app==="classroom"?<div className={frameLayout.nativeBody}><TosVNextClassroom centerId={centerId} localDate={fromDate} profileLabel={profileLabel} onDetailChange={setClassDetailOpen}/></div>:app==="shift"&&data.shift?<div className={frameLayout.nativeBody}><TosVNextShift data={data.shift} localDate={fromDate} centerName={center?.displayName||""} profileLabel={profileLabel}/></div>:<TosVNextContent>
   {app==="shift-lead"&&<TosVNextShiftLead centerId={centerId} workDate={today(zone)}/>}
   {loading&&<p role="status">Đang tải dữ liệu Core thực…</p>}
   {error&&<TosVNextCard><p role="alert">{error}</p></TosVNextCard>}
  </TosVNextContent>}
 </TosVNextFrame>;
}
