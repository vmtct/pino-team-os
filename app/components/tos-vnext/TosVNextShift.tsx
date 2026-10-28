"use client";
/** PAP-941/PAP-1136: Core-backed shift reads; only verified Staff Availability writes are enabled. Other write gates remain. */
import {useEffect,useRef,useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCalendarDays,faClock,faWallet,faCircleCheck,faLocationDot} from "@fortawesome/free-solid-svg-icons";
import {AppBottomNav,AppCard,AppSheet,AppButton,createSlotKeys} from "../tos-ds";
import {workforceApi,type Assignment,type TimekeepingSession} from "@/lib/workforce-api";
import type {OwnIncomePage} from "@/lib/tos-own-income-api";
import type {TosVNextShiftReadWarnings} from "./core-adapters";
import {shiftWeek,shiftWeekOffset,activeScheduleAssignments,assignmentHours,formatIncome,shiftRoleLabel} from "@/lib/tos-vnext-shift-view-model";
import {TosVNextAvailability} from "./TosVNextAvailability";
import styles from "./shift.module.css";
const slot=createSlotKeys(styles);
export type ShiftReadData={assignments:Assignment[];current:TimekeepingSession|null;history:TimekeepingSession[]|null;income:OwnIncomePage|null;warnings:TosVNextShiftReadWarnings};
export function TosVNextShift({data,localDate,centerId,centerName,profileLabel}:{data:ShiftReadData;localDate:string;centerId:string;centerName:string;profileLabel:string|null}){
 const [tab,setTab]=useState("today"),[selected,setSelected]=useState(localDate),[weekAnchor,setWeekAnchor]=useState(localDate);
 const [sheet,setSheet]=useState<"camera"|"history"|"adjust"|null>(null);
 const [photo,setPhoto]=useState<string|null>(null),[cameraError,setCameraError]=useState("");
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),cameraEpoch=useRef(0),track=useRef<HTMLDivElement>(null);
 const [weekResult,setWeekResult]=useState<{centerId:string;start:string;assignments:Assignment[]}|null>(null);
 const [weekError,setWeekError]=useState<{centerId:string;start:string;message:string}|null>(null);
 const days=shiftWeek(weekAnchor),weekStart=days[0].date,weekEnd=days[6].date;
 const weekReady=weekResult?.centerId===centerId&&weekResult.start===weekStart;
 const weekFailed=weekError?.centerId===centerId&&weekError.start===weekStart;
 const assignments=activeScheduleAssignments(weekReady?weekResult.assignments:[],selected);
 const currentAssignment=data.assignments.find(x=>x.id===data.current?.assignmentId)??data.assignments.find(x=>x.workDate===localDate&&x.status==="ACTIVE");
 const latest=data.income?.data[0];
 const paidMinutes=latest?.paidMinutes;
 function stopCamera(){cameraEpoch.current++;stream.current?.getTracks().forEach(x=>x.stop());stream.current=null}
 function closeSheet(){stopCamera();setPhoto(null);setCameraError("");setSheet(null)}
 useEffect(()=>()=>{cameraEpoch.current++;stream.current?.getTracks().forEach(x=>x.stop())},[]);
 // Every navigated week is read from the Staff-authenticated Core schedule endpoint.
 // A stale/failed request never reuses rows from a different Center or week.
 useEffect(()=>{
  let live=true;
  void workforceApi.schedule({centerId,startDate:weekStart,endDate:weekEnd}).then(result=>{
   if(live)setWeekResult({centerId,start:weekStart,assignments:result.data});
  }).catch(reason=>{
   if(live){setWeekResult(null);setWeekError({centerId,start:weekStart,message:reason instanceof Error?reason.message:"Không thể tải lịch ca từ Core."})}
  });
  return()=>{live=false};
 },[centerId,weekStart,weekEnd]);
 function moveWeek(direction:-1|1){const date=shiftWeekOffset(selected,direction);setWeekResult(null);setWeekError(null);setSelected(date);setWeekAnchor(date)}
 useEffect(()=>{if(tab!=="calendar")return;const el=track.current;if(!el)return;
  const reveal=()=>{const day=el.querySelector<HTMLButtonElement>('[aria-pressed="true"]');if(day)el.scrollLeft=day.offsetLeft-(el.clientWidth-day.clientWidth)/2};
  reveal();const observer=new ResizeObserver(reveal);observer.observe(el);return()=>observer.disconnect();
 },[tab,selected]);
 async function startCamera(){
  stopCamera();const epoch=cameraEpoch.current;setCameraError("");setPhoto(null);
  if(!navigator.mediaDevices?.getUserMedia){setCameraError("Camera cần HTTPS hoặc localhost.");return}
  try{const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
   if(epoch!==cameraEpoch.current||!video.current){acquired.getTracks().forEach(x=>x.stop());return}
   stream.current=acquired;video.current.srcObject=acquired;await video.current.play();
  }catch{if(epoch!==cameraEpoch.current)return;stopCamera();setCameraError("Không thể mở camera. Kiểm tra quyền truy cập thiết bị.")}
 }
 function capture(){const source=video.current;if(!source?.videoWidth){setCameraError("Chưa có hình camera.");return}
  const canvas=document.createElement("canvas");canvas.width=source.videoWidth;canvas.height=source.videoHeight;canvas.getContext("2d")?.drawImage(source,0,0);setPhoto(canvas.toDataURL("image/jpeg",.86));stopCamera();
 }
 const dateText=new Intl.DateTimeFormat("vi-VN",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(localDate+"T12:00:00Z"));
 return <main className={styles.shell} data-tos-slot={slot(styles.shell)}><div className={styles.page} data-tos-slot={slot(styles.page)}>
  <div className={styles.content} data-tos-slot={slot(styles.content)}>
   {tab==="today"&&<>
    <div className={styles.intro}><span>{dateText}</span><h2>Chào {profileLabel||"bạn"}, sẵn sàng cho ca hôm nay?</h2><p>Thông tin và thao tác chấm công của bạn.</p></div>
    <section className={styles.hero}><div className={styles.row}><span className={styles.pill}>{data.warnings.timekeeping?"Chưa tải được chấm công":data.current?"Đang trong ca":currentAssignment?"Ca được phân công":"Chưa có ca hôm nay"}</span><span>{currentAssignment?assignmentHours(currentAssignment):"—"}</span></div>
     <h3>{currentAssignment?.shift?.displayLabel||"Ca Làm"}</h3><p><FontAwesomeIcon icon={faLocationDot}/> {centerName}</p><p>{currentAssignment?shiftRoleLabel(currentAssignment):"Chưa có phân công từ Core"}</p>
     <button type="button" className={styles.primary} disabled={!!data.warnings.timekeeping||!!data.current||!currentAssignment} onClick={()=>setSheet("camera")}>{data.current?"Check-out":"Check-in"}</button>
     <small>{data.current?"Check-out chưa được mở trong ứng viên này.":"Check-in yêu cầu bằng chứng ảnh và xác nhận từ Core."}</small>
     {data.warnings.timekeeping&&<p role="alert">{data.warnings.timekeeping}</p>}
    </section>
    <div className={styles.stats}><article><span>Giờ công kỳ gần nhất</span><strong>{paidMinutes==null?"—":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1}).format(paidMinutes/60)+" giờ"}</strong></article><article><span>Ca tiếp theo</span><strong>{data.assignments.filter(x=>x.workDate>localDate&&x.status==="ACTIVE").sort((a,b)=>a.workDate.localeCompare(b.workDate))[0]?.workDate??"—"}</strong></article></div>
    <AppCard className={styles.card}><h3>Lưu ý trong ca</h3><p>Kiểm tra thông tin ca trước khi bắt đầu. Nếu có sai lệch, gửi yêu cầu điều chỉnh trong Giờ công.</p></AppCard>
   </>}
   {tab==="calendar"&&<>
    <div className={styles.intro}><span>LỊCH LÀM VIỆC</span><h2>{new Intl.DateTimeFormat("vi-VN",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(selected+"T12:00:00Z"))}</h2><p>Chọn ngày để xem hoặc đăng ký ca.</p></div>
    <div className={styles.week} role="group" aria-label="Lịch tuần" aria-roledescription="carousel">
     <button type="button" className={styles.weekArrow} aria-label="Tuần trước" onClick={()=>moveWeek(-1)}><span aria-hidden="true">‹</span></button>
     <div className={styles.weekTrack} ref={track} onKeyDown={e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();const index=days.findIndex(x=>x.date===selected);const next=e.key==="Home"?0:e.key==="End"?6:Math.max(0,Math.min(6,index+(e.key==="ArrowRight"?1:-1)));setSelected(days[next].date);track.current?.querySelectorAll("button")[next]?.focus()}}>
      {days.map(day=><button type="button" key={day.date} aria-label={day.label+", "+day.date} aria-pressed={day.date===selected} className={day.date===selected?styles.selected:""} onClick={()=>setSelected(day.date)}><small>{day.label}</small><strong>{Number(day.date.slice(-2))}</strong></button>)}
     </div>
     <button type="button" className={styles.weekArrow} aria-label="Tuần sau" onClick={()=>moveWeek(1)}><span aria-hidden="true">›</span></button>
    </div>
    <AppCard className={styles.card}><div className={styles.row}><h3>Ngày {selected}</h3><span className={styles.pill}>{assignments.length?"Đã phân công":"Chưa có ca"}</span></div>
     {weekFailed&&<p role="alert">{weekError.message}</p>}
     {!weekReady&&!weekFailed&&<p role="status">Đang tải lịch ca từ Core…</p>}
     {weekReady&&assignments.map(row=><div key={row.id}><p><strong>{assignmentHours(row)}</strong> · {centerName}</p><p>{shiftRoleLabel(row)}</p><small>{row.status}</small></div>)}
     {weekReady&&!assignments.length&&<p>Chưa có ca được phân công cho ngày này.</p>}
     <TosVNextAvailability key={centerId+":"+weekStart} centerId={centerId} weekStart={weekStart} weekEnd={weekEnd} selectedDate={selected}/>
    </AppCard><AppCard className={styles.card}><h3>Quy trình đăng ký</h3><p>Nhân viên đăng ký thời gian có thể làm. Vai trò trong ca do quản lý phân công sau.</p></AppCard>
   </>}
   {tab==="hours"&&<>
    <div className={styles.intro}><span>GIỜ CÔNG</span><h2>Lịch sử chấm công</h2><p>Từ đầu tháng đến hiện tại</p></div>
    <AppCard className={styles.card}><h3>Ca gần đây</h3>{data.warnings.history&&<p role="alert">{data.warnings.history}</p>}
     {data.history?.map(row=><div className={styles.history} key={row.id}><div><strong>{row.workDate}</strong><p>{row.checkInAt} – {row.checkOutAt??"Chưa check-out"}</p></div><span className={styles.smallStatus}>{row.status==="OPEN"?"Đang trong ca":"Đã kết thúc"}</span></div>)}
     {data.history?.length===0&&<p>Chưa có phiên chấm công trong khoảng này.</p>}
    </AppCard><AppCard className={styles.card}><h3>Có sai lệch giờ công?</h3><button type="button" className={styles.secondary} onClick={()=>setSheet("adjust")}>Yêu cầu điều chỉnh</button></AppCard>
   </>}
   {tab==="pay"&&<>
    <div className={styles.intro}><span>THU NHẬP</span><h2>{latest?.name??"Thu nhập của tôi"}</h2><p>Theo dõi thu nhập và lịch sử thanh toán.</p></div>
    <section className={styles.hero}><span className={styles.pill}>{latest?.status??"Chưa có kỳ thu nhập"}</span><p>Thu nhập</p><div className={styles.money}>{formatIncome(latest?.amountMinor)}</div><small>{latest?.startDate} {latest?"–":""} {latest?.endDate}</small></section>
    {data.warnings.income&&<p role="alert">{data.warnings.income}</p>}
    <AppCard className={styles.card}><h3>Chi tiết kỳ này</h3>{([["Tiền công cơ bản",latest?.standardMinor],["Điều chỉnh",latest?.adjustmentsMinor]] as const).map(([label,value])=><div className={styles.moneyRow} key={label}><span>{label}</span><strong>{formatIncome(value)}</strong></div>)}<div className={styles.moneyRow}><span>Trạng thái</span><strong>{latest?.status??"—"}</strong></div>{latest?.warnings.map(w=><p key={w}>{w}</p>)}</AppCard>
    <AppCard className={styles.card}><h3>Kỳ lương trước</h3><button type="button" className={styles.secondary} onClick={()=>setSheet("history")}>Xem tất cả kỳ lương ›</button></AppCard>
   </>}
  </div>
  <AppBottomNav label="Điều hướng Ca Làm" active={tab} onChange={setTab} items={[{id:"today",label:"Hôm nay",icon:<FontAwesomeIcon icon={faCircleCheck}/>},{id:"calendar",label:"Lịch ca",icon:<FontAwesomeIcon icon={faCalendarDays}/>},{id:"hours",label:"Giờ công",icon:<FontAwesomeIcon icon={faClock}/>},{id:"pay",label:"Thu nhập",icon:<FontAwesomeIcon icon={faWallet}/>}]} />
  {sheet==="camera"&&<AppSheet title="Chụp bằng chứng Check-in" onClose={closeSheet}><p>Ảnh chỉ nằm trong phiên này. Chưa thể gửi Check-in khi Core chưa hỗ trợ bằng chứng nguyên tử.</p><video ref={video} autoPlay playsInline muted aria-label="Camera trực tiếp"/>{photo&&<img src={photo} alt="Ảnh vừa chụp, chưa gửi"/>}{cameraError&&<p role="alert">{cameraError}</p>}<AppButton onClick={()=>void startCamera()}>Mở camera</AppButton><AppButton onClick={capture}>Chụp ảnh</AppButton><AppButton disabled title="PAP-868/869 chưa được xác minh">Xác nhận ảnh</AppButton></AppSheet>}
  {sheet==="history"&&<AppSheet title="Thu nhập các kỳ trước" onClose={closeSheet}>{data.warnings.income&&<p role="alert">{data.warnings.income}</p>}{data.income?.data.map(period=><div className={styles.moneyRow} key={period.periodId}><span>{period.name}</span><strong>{formatIncome(period.amountMinor)}</strong><small>{period.status}</small></div>)}{data.income?.data.length===0&&<p>Chưa có kỳ thu nhập.</p>}{data.income?.nextOffset!=null&&<p>Còn kỳ thu nhập chưa tải.</p>}</AppSheet>}
  {sheet==="adjust"&&<AppSheet title="Yêu cầu điều chỉnh" onClose={closeSheet}><label className={styles.label}>Mô tả yêu cầu<textarea aria-label="Mô tả yêu cầu"/></label><AppButton disabled title="Chưa xác minh API điều chỉnh">Gửi yêu cầu</AppButton><p>Chưa gửi dữ liệu. Thao tác điều chỉnh chưa khả dụng.</p></AppSheet>}
 </div></main>;
}
