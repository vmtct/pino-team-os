"use client";
/**
 * PAP-938 integration workstation. Isolated worktree ONLY: not a production route.
 * Actual /api/workforce and /api/tos-learning reads; no mutation/fake successful state.
 */
import {useEffect,useMemo,useState} from "react";
import {workforceApi,type WorkforceContext} from "@/lib/workforce-api";
import {TosVNextHome} from "@/app/components/tos-vnext/TosVNextHome";
import {TosVNextTraining} from "@/app/components/tos-vnext/TosVNextTraining";
import {TosVNextClassroom} from "@/app/components/tos-vnext/TosVNextClassroom";
import {TosVNextReception} from "@/app/components/tos-vnext/TosVNextReception";
import {TosVNextStation} from "@/app/components/tos-vnext/TosVNextStation";
import {TosVNextShiftLead} from "@/app/components/tos-vnext/TosVNextShiftLead";
import {resolveTosAppAccess} from "@/lib/tos-app-access";
import {
 appIdentity,TosVNextFrame,TosVNextAppHeader,TosVNextContent,
 TosVNextCard,TosVNextHeading,TosVNextBottomNav,TosVNextButton,TosVNextStatus,
 tosVNextStyle,type TosVNextAppId
} from "@/app/components/tos-vnext/TosVNextUI";
import {
 TOS_BACKEND_MATRIX,staffContext,shiftReadModel,type TosVNextShiftReadWarnings
} from "@/app/components/tos-vnext/core-adapters";
import type {Assignment,TimekeepingSession} from "@/lib/workforce-api";
import type {OwnIncomePage} from "@/lib/tos-own-income-api";



type Section="home"|TosVNextAppId;
type ShiftData={assignments:Assignment[];current:TimekeepingSession|null;history:TimekeepingSession[]|null;income:OwnIncomePage|null;warnings:TosVNextShiftReadWarnings};
type ReadData={shift?:ShiftData};
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
 const [shiftTab,setShiftTab]=useState<"today"|"calendar"|"hours"|"pay">("today");
 const [classDetailOpen,setClassDetailOpen]=useState(false);
 const [data,setData]=useState<ReadData>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [desktop,setDesktop]=useState(false);
 useEffect(()=>{if(!homeNotice)return;const timer=setTimeout(()=>setHomeNotice(""),2700);return()=>clearTimeout(timer)},[homeNotice]);
 const center=ctx?.centers.find(c=>c.id===centerId);
 const zone=center?.timeZone||"Asia/Ho_Chi_Minh";
 const fromDate=today(zone);
 const access=useMemo(()=>{
  if(!ctx||!centerId)return null;
  // Existing resolver enforces local role presentation. API endpoints MUST independently enforce server authority.
  return resolveTosAppAccess({assignments:data.shift?.assignments??[],centerId,
   nowLocal:fromDate+"T"+new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()),
   desktop,scheduleReady:!!data.shift});
 },[ctx,centerId,data.shift,desktop,zone,fromDate]);
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
  let active=true;
  setError("");setLoading(true);setData({});
  void shiftReadModel(centerId,today(zone,-1),today(zone,14)).then(v=>{
   if(active)setData(prev=>({...prev,shift:{assignments:v.assignments,current:v.current,history:v.history,income:v.income,warnings:v.warnings}}));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Không thể tải trạng thái ca.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[centerId,ctx,zone]);
 async function choose(next:Section){
  if(next==="home"){setApp("home");return}
  if(!ctx||!centerId||loading){setHomeNotice("Cần xác thực nhân viên và cơ sở trước khi mở ứng dụng.");return}
  if(next==="station"&&!desktop){setHomeNotice("Trạm TOS chỉ sử dụng trên máy tính.");return}
  if(next==="reception"&&!access?.reception){setError("Ca này chưa có quyền Tiếp Tân.");return}
  if(next==="classroom"&&!access?.classroom){setError("Ca này chưa có quyền Lớp Học.");return}
  if(next==="shift-lead"&&!access?.["shift-lead"]){setError("Ca này chưa có quyền Trưởng Ca.");return}
  setApp(next);setError("");
 }
 const isDesktop=app==="station";
 const nextAssignment=[...(data.shift?.assignments??[])].filter(row=>row.status!=="CANCELLED" && row.workDate>=fromDate)
  .sort((a,b)=>a.workDate.localeCompare(b.workDate))[0]??null;
 if(app==="home")return <TosVNextHome profileLabel={profileLabel} centerName={center?.displayName}
  nextAssignment={nextAssignment} busy={loading||!ctx}
  allowed={id=>id==="shift"||id==="training"?!!ctx:id==="station"?!!ctx&&desktop:!!access?.[id]}
  onOpen={id=>void choose(id)} onNotify={()=>setHomeNotice("Thông báo chưa sẵn sàng.")}
  notice={homeNotice||error}/>;
 return <TosVNextFrame app={app} mode={isDesktop?"desktop":"mobile"}>
  {(app!=="station"&&(app!=="classroom"||!classDetailOpen))&&<TosVNextAppHeader app={app} station={center?.displayName} onHome={()=>void choose("home")}/> }
  <TosVNextContent>
   {app==="shift"&&<>
    <TosVNextHeading title={{today:"Hôm nay",calendar:"Lịch ca",hours:"Giờ công",pay:"Thu nhập"}[shiftTab]} meta={today(zone)}/>
    {shiftTab==="today"&&<TosVNextCard>
     <h2 style={{fontSize:18,margin:"0 0 12px"}}>Trạng thái chấm công</h2>
     {data.shift?.warnings.timekeeping?<p role="alert" className={tosVNextStyle.secondary}>Không tải được phiên chấm công: {data.shift.warnings.timekeeping}</p>:data.shift?.current?<><TosVNextStatus>{data.shift.current.status}</TosVNextStatus><p className={tosVNextStyle.body}>Check-in: {data.shift.current.checkInAt}</p></>:<p className={tosVNextStyle.secondary}>Không có ca chấm công đang mở.</p>}
     <TosVNextButton disabled>Check-in yêu cầu ảnh thật + Core PAP-869</TosVNextButton>
     <p className={tosVNextStyle.secondary}>Không gọi legacy checkIn trực tiếp; cần ảnh camera liên kết atomic timekeeping.</p>
    </TosVNextCard>}
    {shiftTab==="calendar"&&<TosVNextCard><TosVNextHeading title="Lịch ca Core" meta={String(data.shift?.assignments.length??0)+" ca"}/>
      {(data.shift?.assignments??[]).map(s=><p className={tosVNextStyle.body} key={s.id}>{s.workDate} · {s.shift?.displayLabel||s.coverageMode} · {s.status}</p>)}
      {!data.shift?.assignments.length&&<p className={tosVNextStyle.secondary}>Không có ca theo bộ lọc.</p>}
     </TosVNextCard>}
    {shiftTab==="hours"&&<TosVNextCard><TosVNextHeading title="Lịch sử giờ công" meta={data.shift?.history?String(data.shift.history.length)+" phiên":"Chưa có dữ liệu"}/>
       {data.shift?.warnings.history&&<p role="alert" className={tosVNextStyle.secondary}>Không tải được lịch sử: {data.shift.warnings.history}</p>}
       {(data.shift?.history??[]).map(row=><div key={row.id}>
        <p className={tosVNextStyle.body}><strong>{row.workDate}</strong> · {row.status==="OPEN"?"Đang trong ca":"Đã kết thúc"}</p>
        <p className={tosVNextStyle.secondary}>Check-in: {row.checkInAt} · Check-out: {row.checkOutAt??"Chưa có"}</p>
       </div>)}
       {data.shift?.history?.length===0&&<p className={tosVNextStyle.secondary}>Chưa có phiên chấm công trong khoảng ngày được chọn.</p>}
      </TosVNextCard>}
    {shiftTab==="pay"&&<TosVNextCard><TosVNextHeading title="Thu nhập của tôi" meta={data.shift?.income?String(data.shift.income.total)+" kỳ":"Chưa có dữ liệu"}/>
      {data.shift?.warnings.income&&<p role="alert" className={tosVNextStyle.secondary}>Không tải được thu nhập: {data.shift.warnings.income}</p>}
      {(data.shift?.income?.data??[]).map(x=><p className={tosVNextStyle.body} key={x.periodId}>{x.name} · {x.status} · {x.amountMinor===null?"Chưa có số liệu":new Intl.NumberFormat("vi-VN").format(x.amountMinor/100)+" ₫"}</p>)}
      <p className={tosVNextStyle.secondary}>Dữ liệu từ API self; không truyền staff ID, không tự tính lại kỳ đã chốt.</p></TosVNextCard>}
   </>}
   {app==="reception"&&<TosVNextReception centerId={centerId} workDate={today(zone)}
    assignments={data.shift?.assignments??[]}/>}
   {app==="classroom"&&<TosVNextClassroom centerId={centerId} localDate={today(zone)}
    onDetailChange={setClassDetailOpen}/>}
   {app==="training"&&<TosVNextTraining/>}
   {app==="shift-lead"&&<TosVNextShiftLead centerId={centerId} workDate={today(zone)}/>}
   {app==="station"&&<TosVNextStation desktop={desktop} centerName={center?.displayName||""}
    onHome={()=>void choose("home")}/>}
   {loading&&<p role="status">Đang tải dữ liệu Core thực…</p>}
   {error&&<TosVNextCard><p role="alert" style={{color:"#a32b39",margin:0,fontSize:14}}>{error}</p></TosVNextCard>}
   <TosVNextCard>
     <TosVNextHeading title="Backend readiness" meta={appIdentity(app).title}/>
     {TOS_BACKEND_MATRIX.filter(r=>r.app===app).map(r=><p className={tosVNextStyle.secondary} key={r.capability}><strong>{r.status}</strong> · {r.capability} — {r.description}</p>)}
   </TosVNextCard>
  </TosVNextContent>
  {app==="shift"&&<TosVNextBottomNav label="Điều hướng Ca Làm" active={shiftTab} onChange={x=>setShiftTab(x as typeof shiftTab)}
    items={[{id:"today",label:"Hôm nay",icon:"◉"},{id:"calendar",label:"Lịch ca",icon:"▦"},{id:"hours",label:"Giờ công",icon:"◷"},{id:"pay",label:"Thu nhập",icon:"₫"}]}/>}
 </TosVNextFrame>;
}
