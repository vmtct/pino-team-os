"use client";
/**
 * PAP-938 integration workstation. Isolated worktree ONLY: not a production route.
 * Actual /api/workforce and /api/tos-learning reads; no mutation/fake successful state.
 */
import {useEffect,useState} from "react";
import {workforceApi,type WorkforceContext,type FounderCenterTimekeeping,type FounderCenterDuty,type FounderCenterTraining,type FounderCenterStation} from "@/lib/workforce-api";
import {TosVNextShift} from "@/app/components/tos-vnext/TosVNextShift";
import frameLayout from "@/app/components/tos-ds/phone-frame.module.css";
import {TosVNextHome} from "@/app/components/tos-vnext/TosVNextHome";
import {TosVNextTraining} from "@/app/components/tos-vnext/TosVNextTraining";
import {TosVNextClassroom} from "@/app/components/tos-vnext/TosVNextClassroom";
import {TosVNextReception} from "@/app/components/tos-vnext/TosVNextReception";
import {TosVNextStation} from "@/app/components/tos-vnext/TosVNextStation";
import {TosVNextShiftLead} from "@/app/components/tos-vnext/TosVNextShiftLead";
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
type ReadData={shift?:ShiftData;founder?:{centerId:string;assignments:FounderAssignment[];truncated:boolean};visits?:FounderVisits;timekeeping?:FounderCenterTimekeeping;duty?:FounderCenterDuty;training?:FounderCenterTraining;station?:FounderCenterStation;founderError?:string;visitsError?:string;timekeepingError?:string;dutyError?:string;trainingError?:string;stationError?:string};
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
 const [loading,setLoading]=useState(true); // Identity and Center readiness only
 const [shiftLoading,setShiftLoading]=useState(false);
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
 // Enforce identity, Center and desktop requirements. Shift clock and API health
 // never eject a user; Core still checks authorization on each action.
 useEffect(()=>{
  if(app==="home"||loading||ctx?.founderMode)return;
  if(!ctx||!centerId||!canOpenVNextApp(app,{authenticated:!!ctx,centerReady:!!centerId,desktop})){
   setApp("home");setClassDetailOpen(false);
   setHomeNotice(app==="station"?"Trạm TOS cần màn hình desktop.":"Tài khoản hoặc cơ sở chưa sẵn sàng.");
  }
 },[app,loading,ctx,centerId,desktop]);
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
   setError("");setData({});setShiftLoading(true);
   void Promise.allSettled([
    workforceApi.founderCenterSchedule({centerId,startDate:today(zone),endDate:today(zone,14)}),
    workforceApi.founderCenterVisits({centerId,status:"ALL"}),
    workforceApi.founderCenterTimekeeping({centerId,workDate:fromDate}),
    workforceApi.founderCenterDuty({centerId,workDate:fromDate}),
    workforceApi.founderCenterTraining({centerId}),
    workforceApi.founderCenterStation({centerId}),
   ]).then(([schedule,visits,timekeeping,duty,training,station])=>{
    if(!active)return;
    setData({
     ...(schedule.status==="fulfilled"?{founder:schedule.value.data}:{founderError:schedule.reason instanceof Error?schedule.reason.message:"Không thể tải phân công Center."}),
     ...(visits.status==="fulfilled"?{visits:visits.value.data}:{visitsError:visits.reason instanceof Error?visits.reason.message:"Không thể tải Student Visits."}),
     ...(timekeeping.status==="fulfilled"?{timekeeping:timekeeping.value.data}:{timekeepingError:timekeeping.reason instanceof Error?timekeeping.reason.message:"Không thể tải giờ công Center."}),
     ...(duty.status==="fulfilled"?{duty:duty.value.data}:{dutyError:duty.reason instanceof Error?duty.reason.message:"Không thể tải Duty Center."}),
     ...(training.status==="fulfilled"?{training:training.value.data}:{trainingError:training.reason instanceof Error?training.reason.message:"Không thể tải Training Center."}),
     ...(station.status==="fulfilled"?{station:station.value.data}:{stationError:station.reason instanceof Error?station.reason.message:"Không thể tải thiết bị Center."}),
    });
   })
    .finally(()=>{if(active)setShiftLoading(false)});
   return()=>{active=false};
  }
  let active=true;
  setError("");setShiftLoading(true);setData({});
  void shiftReadModel(centerId,today(zone).slice(0,8)+"01",today(zone,14)).then(v=>{
   if(active)setData(prev=>({...prev,shift:{assignments:v.assignments,current:v.current,history:v.history,income:v.income,warnings:v.warnings}}));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Không thể tải trạng thái ca.")})
   .finally(()=>{if(active)setShiftLoading(false)});
  return()=>{active=false};
 },[centerId,ctx,zone,fromDate,scheduleRefresh]);
 async function choose(next:Section){
  if(next==="home"){setApp("home");return}
  if(!ctx||!centerId||loading){setHomeNotice("Cần xác thực nhân viên và cơ sở trước khi mở ứng dụng.");return}
  if(!canOpenVNextApp(next,{authenticated:!!ctx,centerReady:!!centerId,
   desktop})){
   setHomeNotice(next==="station"?"Trạm TOS cần màn hình desktop.":"Tài khoản hoặc cơ sở chưa sẵn sàng.");return;
  }
  setApp(next);setError("");
 }
 const nowLocalTime=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(clockNow);
 const nextAssignment=nextConfirmedAssignment(data.shift?.assignments??[],centerId,fromDate,nowLocalTime);
 // Render-guard only for session/Center and desktop. Core independently checks
 // every sensitive read/write; scheduling data remains advisory.
 const appRenderable=app!=="home"&&!loading&&canOpenVNextApp(app,{
  authenticated:!!ctx,centerReady:!!centerId,desktop
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
   nextAssignment={null} busy={loading||!centerId} scheduleLoading={shiftLoading}
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
      {data.founderError&&<p role="alert">{data.founderError}</p>}
      {!data.founderError&&!data.founder&&<p role="status">Dữ liệu chưa sẵn sàng.</p>}
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
       {data.visitsError&&<p role="alert">{data.visitsError}</p>}
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
      app==="training"?null:<p>Chưa có read-model Center-wide được xác minh cho module này; không dùng Staff-self hoặc dữ liệu giả.</p>}
     {app==="shift"&&<section aria-label="Giờ công Center">
      <h3>Giờ công hôm nay · Dữ liệu thực từ Core</h3>
      {data.timekeepingError&&<p role="alert">{data.timekeepingError}</p>}
      {data.timekeeping?<>
       <p>Tổng {data.timekeeping.summary.totalSessions} phiên · Đang làm {data.timekeeping.summary.openSessions} · Đã kết thúc {data.timekeeping.summary.closedSessions}</p>
       {!data.timekeeping.sessions.length&&<p>Chưa có phiên giờ công hôm nay.</p>}
       {data.timekeeping.sessions.map(row=><article key={row.id}>
        <strong>{row.staffLabel}</strong><p>{row.status} · {row.checkInAt} – {row.checkOutAt??"Đang làm"}</p>
       </article>)}
       {data.timekeeping.hasNext&&<p role="status">Giới hạn 50 phiên; có trang tiếp theo.</p>}
      </>:!data.timekeepingError&&<p role="status">Dữ liệu giờ công chưa sẵn sàng.</p>}
     </section>}
     {app==="shift-lead"&&<section aria-label="Duty Center">
      <h3>Duty instances hôm nay · Dữ liệu thực từ Core</h3>
      {data.dutyError&&<p role="alert">{data.dutyError}</p>}
      {data.duty?<>
       {!data.duty.instances.length&&<p>Chưa có Duty instance trong Center.</p>}
       {data.duty.instances.map(row=><article key={row.id}>
        <strong>{row.staffLabel}</strong><p>{row.definitionRef} · {row.workDate}</p>
       </article>)}
       {data.duty.truncated&&<p role="status">Chỉ hiển thị 50 Duty instance mới nhất.</p>}
      </>:!data.dutyError&&<p role="status">Duty Center chưa sẵn sàng.</p>}
      <p>Danh sách instance không thể hiện trạng thái hoàn thành; chưa phải bảng closeout.</p>
     </section>}
     {app==="station"&&<section aria-label="Thiết bị Center">
      <h3>Thiết bị Center · Dữ liệu thực từ Core</h3>
      {data.stationError&&<p role="alert">{data.stationError}</p>}
      {data.station?<>
       {!data.station.devices.length&&<p>Chưa có thiết bị đã đăng ký.</p>}
       {data.station.devices.map(row=><article key={row.id}>
        <strong>{row.displayName}</strong><p>{row.status} · Seen: {row.lastSeenAt??"Chưa có"}</p>
       </article>)}
       {data.station.truncated&&<p role="status">Chỉ hiển thị 50 thiết bị đầu tiên.</p>}
      </>:!data.stationError&&<p role="status">Thiết bị Center chưa sẵn sàng.</p>}
     </section>}
     {app==="training"&&<section aria-label="Training Center">
      <h3>Thăng Tiến · Training thực từ Core</h3>
      {data.trainingError&&<p role="alert">{data.trainingError}</p>}
      {data.training?<>
       <h4>Danh mục đào tạo</h4>
       {!data.training.catalog.length&&<p>Chưa có khóa học đã phát hành.</p>}
       {data.training.catalog.map(row=><article key={row.moduleKey}>
        <strong>{row.title}</strong><p>{row.track??"Chưa phân nhóm"}</p>
       </article>)}
       {data.training.catalogTruncated&&<p role="status">Chỉ hiển thị 50 khóa học.</p>}
       <h4>Phân công đào tạo tại Center</h4>
       {!data.training.assignments.length&&<p>Chưa có phân công Training của nhân sự được cấp role Center.</p>}
       {data.training.assignments.map(row=><article key={row.id}>
        <strong>{row.staffLabel}</strong><p>{row.moduleTitle} · {row.status}</p>
       </article>)}
       {data.training.assignmentsTruncated&&<p role="status">Chỉ hiển thị 50 phân công.</p>}
      </>:!data.trainingError&&<p role="status">Training Center chưa sẵn sàng.</p>}
     </section>}     <p>Để xem và quản lý dữ liệu vận hành của trung tâm, sử dụng Back Office trong khi giao diện giám sát Founder cho ứng dụng này được hoàn thiện.</p>
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
   setShiftLoading(true);setData({});setCenterId(id);setHomeNotice("");
  }}
  nextAssignment={nextAssignment} busy={loading||!ctx} scheduleLoading={shiftLoading}
  allowed={id=>canOpenVNextApp(id,{authenticated:!!ctx,centerReady:!!centerId,
   desktop})}
  onOpen={id=>void choose(id)} onNotify={()=>setHomeNotice("Thông báo chưa sẵn sàng.")}
  notice={homeNotice||error}/>;
 if(app==="station")return <TosVNextFrame app="station" mode="desktop"><TosVNextStation desktop={desktop} centerName={center?.displayName||""} onHome={()=>void choose("home")}/></TosVNextFrame>;
 return <TosVNextFrame app={app} mode="mobile">
  {(app!=="classroom"||!classDetailOpen)&&<TosVNextAppHeader app={app} station={center?.displayName} onHome={()=>void choose("home")}/> }
  {app==="reception"?<TosVNextReception centerId={centerId} centerName={center?.displayName||""} profileLabel={profileLabel||""} workDate={today(zone)} assignments={data.shift?.assignments??[]}/>:app==="training"?<TosVNextTraining/>:app==="classroom"?<div className={frameLayout.nativeBody}><TosVNextClassroom centerId={centerId} localDate={fromDate} profileLabel={profileLabel} onDetailChange={setClassDetailOpen}/></div>:app==="shift"&&data.shift?<div className={frameLayout.nativeBody}><TosVNextShift data={data.shift} localDate={fromDate} centerName={center?.displayName||""} profileLabel={profileLabel}/></div>:<TosVNextContent>
   {app==="shift-lead"&&<TosVNextShiftLead centerId={centerId} workDate={today(zone)}/>}
   {shiftLoading&&<p role="status">Đang tải dữ liệu ca từ Core…</p>}
   {app==="shift"&&!shiftLoading&&!data.shift&&<TosVNextCard><p role="status">Lịch ca và giờ công chưa khả dụng. Trạng thái chấm công chưa được xác minh.</p></TosVNextCard>}
   {error&&<TosVNextCard><p role="alert">{error}</p></TosVNextCard>}
  </TosVNextContent>}
 </TosVNextFrame>;
}
