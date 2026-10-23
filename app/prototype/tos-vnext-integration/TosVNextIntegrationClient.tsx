"use client";
/**
 * PAP-938 integration workstation. Isolated worktree ONLY: not a production route.
 * Actual /api/workforce and /api/tos-learning reads; no mutation/fake successful state.
 */
import {useEffect,useMemo,useState} from "react";
import {workforceApi,type WorkforceContext} from "@/lib/workforce-api";
import {resolveTosAppAccess} from "@/lib/tos-app-access";
import {
 appIdentity,SIX_TOS_APPS,TosVNextFrame,TosVNextAppHeader,TosVNextContent,
 TosVNextCard,TosVNextHeading,TosVNextBottomNav,TosVNextButton,TosVNextStatus,
 TosVNextField,TosVNextAppTile,tosVNextStyle,type TosVNextAppId
} from "@/app/components/tos-vnext/TosVNextUI";
import {
 TOS_BACKEND_MATRIX,staffContext,shiftReadModel,receptionVisitReadModel,
 classroomLegacyReadModel,ownLegacyTrainingReadModel,dutyContextReadModel
} from "@/app/components/tos-vnext/core-adapters";
import type {Assignment,TimekeepingSession,StaffDutyBoard} from "@/lib/workforce-api";
import type {OwnIncomePage} from "@/lib/tos-own-income-api";
import type {StudentVisit} from "@/lib/tos-day-of-learning-api";
import type {DaySession} from "@/lib/tos-learning-api";

type Section="home"|TosVNextAppId;
type ShiftData={assignments:Assignment[];current:TimekeepingSession|null;income:OwnIncomePage};
type ReadData={shift?:ShiftData;classroom?:DaySession[];training?:{assignments:number;qualifications:number};duty?:StaffDutyBoard};
function today(timeZone:string,offsetDays=0){
 const date=new Date(Date.now()+offsetDays*86400000);
 return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
export default function TosVNextIntegrationPreview(){
 const [ctx,setCtx]=useState<WorkforceContext|null>(null);
 const [centerId,setCenterId]=useState("");
 const [app,setApp]=useState<Section>("home");
 const [shiftTab,setShiftTab]=useState<"today"|"calendar"|"hours"|"pay">("today");
 const [data,setData]=useState<ReadData>({});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [studentId,setStudentId]=useState("");
 const [visit,setVisit]=useState<StudentVisit|null|undefined>(undefined);
 const [visitPending,setVisitPending]=useState(false);
 const [desktop,setDesktop]=useState(false);
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
  let valid=true;void staffContext().then(value=>{
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
   if(active)setData(prev=>({...prev,shift:{assignments:v.assignments,current:v.current,income:v.income}}));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Không thể tải trạng thái ca.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[centerId,ctx,zone]);
 async function choose(next:Section){
  if(next==="home"){setApp("home");return}
  if(next==="station"&&!desktop){setError("Trạm TOS chỉ sử dụng trên máy tính.");return}
  if(next==="reception"&&!access?.reception){setError("Ca này chưa có quyền Tiếp Tân.");return}
  if(next==="classroom"&&!access?.classroom){setError("Ca này chưa có quyền Lớp Học.");return}
  if(next==="shift-lead"&&!access?.["shift-lead"]){setError("Ca này chưa có quyền Trưởng Ca.");return}
  setApp(next);setError("");setLoading(true);
  try{
   if(next==="classroom"){const sessions=await classroomLegacyReadModel(centerId,today(zone));setData(prev=>({...prev,classroom:sessions}))}
   if(next==="training"){const own=await ownLegacyTrainingReadModel();setData(prev=>({...prev,training:{assignments:own.assignments.length,qualifications:own.qualifications.length}}))}
   if(next==="shift-lead"){const duty=await dutyContextReadModel(centerId,today(zone));setData(prev=>({...prev,duty}))}
  }catch(e){setError(e instanceof Error?e.message:"Không thể tải dữ liệu.")}finally{setLoading(false)}
 }
 async function checkVisit(){
  if(!studentId.trim()||!centerId)return;
  setVisitPending(true);setVisit(undefined);setError("");
  try{setVisit(await receptionVisitReadModel(centerId,studentId.trim()))}
  catch(e){setError(e instanceof Error?e.message:"Không thể tải tình trạng học viên.")}
  finally{setVisitPending(false)}
 }
 const isDesktop=app==="station";
 return <TosVNextFrame app={app==="home"?"shift":app} mode={isDesktop?"desktop":"mobile"}>
  {app!=="home"&&<TosVNextAppHeader app={app} station={center?.displayName} onHome={()=>void choose("home")}/>}
  <TosVNextContent>
   {app==="home"&&<>
    <small className={tosVNextStyle.caption}>PINO · TEAM OPS · VNext integration, chưa phát hành</small>
    <h1 style={{fontSize:24,margin:0,lineHeight:1.25}}>TOS VNext · 6 ứng dụng</h1>
    <p className={tosVNextStyle.secondary}>Dữ liệu Core thực, chỉ đọc. Không có demo check-in hoặc ghi nhận Diary.</p>
    <TosVNextCard><TosVNextHeading title="Tài khoản / cơ sở" meta={loading?"Đang tải":"Đã xác thực"}/>
     <p className={tosVNextStyle.body}>{center?.displayName??"Không có trung tâm"}</p>
     {ctx?.centers.length && ctx.centers.length>1?<TosVNextField label="Trung tâm"><select value={centerId} onChange={e=>setCenterId(e.target.value)}>{ctx.centers.map(c=><option value={c.id} key={c.id}>{c.displayName}</option>)}</select></TosVNextField>:null}
    </TosVNextCard>
    <TosVNextHeading title="Ứng dụng" meta="6 apps"/>
    <div className={tosVNextStyle.grid}>{SIX_TOS_APPS.map(a=><TosVNextAppTile key={a.id} app={a.id}
     disabled={!ctx||loading||(a.id==="station"&&!desktop)||(a.id==="reception"&&!access?.reception)||(a.id==="classroom"&&!access?.classroom)||(a.id==="shift-lead"&&!access?.["shift-lead"])}
     onClick={()=>void choose(a.id)}/>)}</div>
    <p className={tosVNextStyle.secondary}>Tiếp Tân/Lớp Học/Trưởng Ca được kiểm soát theo ca. Trạm TOS chỉ desktop. Thăng Tiến có dữ liệu Training F0 hiện hữu, chưa phải V5.</p>
   </>}
   {app==="shift"&&<>
    <TosVNextHeading title={{today:"Hôm nay",calendar:"Lịch ca",hours:"Giờ công",pay:"Thu nhập"}[shiftTab]} meta={today(zone)}/>
    {shiftTab==="today"&&<TosVNextCard>
     <h2 style={{fontSize:18,margin:"0 0 12px"}}>Trạng thái chấm công</h2>
     {data.shift?.current?<><TosVNextStatus>{data.shift.current.status}</TosVNextStatus><p className={tosVNextStyle.body}>Check-in: {data.shift.current.checkInAt}</p></>:<p className={tosVNextStyle.secondary}>Không có ca chấm công đang mở.</p>}
     <TosVNextButton disabled>Check-in yêu cầu ảnh thật + Core PAP-869</TosVNextButton>
     <p className={tosVNextStyle.secondary}>Không gọi legacy checkIn trực tiếp; cần ảnh camera liên kết atomic timekeeping.</p>
    </TosVNextCard>}
    {shiftTab==="calendar"&&<TosVNextCard><TosVNextHeading title="Lịch ca Core" meta={String(data.shift?.assignments.length??0)+" ca"}/>
      {(data.shift?.assignments??[]).map(s=><p className={tosVNextStyle.body} key={s.id}>{s.workDate} · {s.shift?.displayLabel||s.coverageMode} · {s.status}</p>)}
      {!data.shift?.assignments.length&&<p className={tosVNextStyle.secondary}>Không có ca theo bộ lọc.</p>}
     </TosVNextCard>}
    {shiftTab==="hours"&&<TosVNextCard><TosVNextHeading title="Timekeeping Core"/>
       <p className={tosVNextStyle.body}>{data.shift?.current?data.shift.current.status:"Chưa có phiên chấm công mở"}</p>
       <p className={tosVNextStyle.secondary}>Lịch sử chi tiết dùng workforceApi.history; không giả lập giờ công.</p>
      </TosVNextCard>}
    {shiftTab==="pay"&&<TosVNextCard><TosVNextHeading title="Thu nhập của tôi" meta={String(data.shift?.income.total??0)+" kỳ"}/>
      {(data.shift?.income.data??[]).map(x=><p className={tosVNextStyle.body} key={x.periodId}>{x.name} · {x.status} · {x.amountMinor===null?"Chưa có số liệu":new Intl.NumberFormat("vi-VN").format(x.amountMinor/100)+" ₫"}</p>)}
      <p className={tosVNextStyle.secondary}>Dữ liệu từ API self; không truyền staff ID, không tự tính lại kỳ đã chốt.</p></TosVNextCard>}
   </>}
   {app==="reception"&&<>
    <TosVNextHeading title="Tiếp Tân · Core Attendance" meta="READ ONLY"/>
    <TosVNextCard><p className={tosVNextStyle.secondary}>Đọc trạng thái Student Visit từ Core. Đón–trả và Pinoria chưa bật write khi chưa có đầy đủ xác nhận người đón/quyền thao tác.</p>
     <TosVNextField label="Mã học viên (Core Student ID)"><input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Nhập ID thật để tra cứu" /></TosVNextField>
     <TosVNextButton onClick={()=>void checkVisit()} disabled={!studentId.trim()||visitPending}>{visitPending?"Đang truy vấn…":"Xem Student Visit"}</TosVNextButton>
     {visit!==undefined?<p className={tosVNextStyle.body}>{visit===null?"Không có Student Visit đang mở.":visit.checkedOutAt?"Đã trả: "+visit.checkedOutAt:"Đã đến: "+visit.checkedInAt}</p>:null}
    </TosVNextCard>
   </>}
   {app==="classroom"&&<>
    <TosVNextHeading title="Lớp học · Core hiện hữu" meta="LEGACY ONLY"/>
    <TosVNextCard><p className={tosVNextStyle.secondary}>API sessionsDay hiện có vẫn theo Session, chưa được chứng minh đáp ứng V18b Path Diary. Không mở ghi chú Diary giả.</p>
      {(data.classroom??[]).map(x=><p key={x.id} className={tosVNextStyle.body}>{x.operationalName||x.pathDisplayName} · {x.scheduledStartsLocal}</p>)}
      {!data.classroom?.length&&<p className={tosVNextStyle.secondary}>Core không trả lớp trong ngày hoặc quyền chưa đủ.</p>}
    </TosVNextCard>
   </>}
   {app==="training"&&<>
    <TosVNextHeading title="Thăng Tiến · Training Core" meta="F0 LEGACY"/>
    <TosVNextCard><p className={tosVNextStyle.body}>Assignment hiện có: {data.training?.assignments??"Chưa tải"}</p>
      <p className={tosVNextStyle.body}>Chứng nhận hiện có: {data.training?.qualifications??"Chưa tải"}</p>
      <p className={tosVNextStyle.secondary}>Training V5 metadata/register/eligibility chưa có contract xác nhận, nên chưa bật CTA Đăng ký/Chứng Nhận mới.</p>
    </TosVNextCard>
   </>}
   {app==="shift-lead"&&<>
    <TosVNextHeading title="Trưởng Ca · Duty Context" meta="Core read"/>
    <TosVNextCard><p className={tosVNextStyle.body}>Obligation: {data.duty?.duties.length??"Chưa tải"}</p>
      {(data.duty?.duties??[]).map(x=><p className={tosVNextStyle.secondary} key={x.obligationId}>{x.type} · {x.status} · {x.sourceDomain}</p>)}
      <p className={tosVNextStyle.secondary}>Không có app Nhiệm Vụ riêng. Quyền thay đổi và settlement cần PAP-944.</p>
    </TosVNextCard>
   </>}
   {app==="station"&&<>
    <TosVNextHeading title="Trạm TOS · full-width desktop" meta="Core API GAP"/>
    <TosVNextCard><p className={tosVNextStyle.body}>Node / Center: {center?.displayName||"Chưa có quyền"}</p>
      <p className={tosVNextStyle.secondary}>Thiết bị/TV/Pinoria chưa được xác minh API điều khiển. Không cấp nút tác động giả.</p>
    </TosVNextCard>
   </>}
   {loading&&<p role="status">Đang tải dữ liệu Core thực…</p>}
   {error&&<TosVNextCard><p role="alert" style={{color:"#a32b39",margin:0,fontSize:14}}>{error}</p></TosVNextCard>}
   {app!=="home"&&<TosVNextCard>
     <TosVNextHeading title="Backend readiness" meta={appIdentity(app).title}/>
     {TOS_BACKEND_MATRIX.filter(r=>r.app===app).map(r=><p className={tosVNextStyle.secondary} key={r.capability}><strong>{r.status}</strong> · {r.capability} — {r.description}</p>)}
   </TosVNextCard>}
  </TosVNextContent>
  {app==="shift"&&<TosVNextBottomNav label="Điều hướng Ca Làm" active={shiftTab} onChange={x=>setShiftTab(x as typeof shiftTab)}
    items={[{id:"today",label:"Hôm nay",icon:"◉"},{id:"calendar",label:"Lịch ca",icon:"▦"},{id:"hours",label:"Giờ công",icon:"◷"},{id:"pay",label:"Thu nhập",icon:"₫"}]}/>}
 </TosVNextFrame>;
}
