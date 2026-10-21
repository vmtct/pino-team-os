"use client";
import {useEffect,useMemo,useState} from "react";
import styles from "./checkin-photo-grid.module.css";
type Row={
 sessionId:string;workDate:string;checkInAt:string;checkOutAt:string|null;
 photoId:string|null;photoStatus:"STAGED"|"BOUND"|"DELETE_PENDING"|"DELETED"|null;
 capturedAt:string|null;deleteAfter:string|null;deletedAt:string|null;
};
type State={kind:"loading"}|{kind:"error";message:string}|{kind:"ready";data:Row[];partial:boolean};
interface Props{centerId:string;periodId:string;staffId:string;workDates:string[];}
function photoPath(centerId:string,id:string){
 return "/api/bo/workforce/timekeeping/photos/"+encodeURIComponent(id)+
  "?centerId="+encodeURIComponent(centerId);
}
function inCenterDate(iso:string){return iso.slice(8,10)+"/"+iso.slice(5,7);}
function time(iso:string){return new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",
 timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(iso));}
export function CheckInPhotoGrid({centerId,periodId,staffId,workDates}:Props){
 const [state,setState]=useState<State>({kind:"loading"});
 const [expanded,setExpanded]=useState<Row|null>(null);
 useEffect(()=>{
  let valid=true;
  setState({kind:"loading"});setExpanded(null);
  const controller=new AbortController();
  (async()=>{
    const rows:Row[]=[];
    let offset=0,partial=false;
    for(let i=0;i<10;i++){
      const url="/api/bo/workforce/payroll/periods/"+periodId+"/staff/"+staffId+
        "/checkin-photos?"+new URLSearchParams({centerId,offset:String(offset)}).toString();
      const response=await fetch(url,{cache:"no-store",credentials:"same-origin",signal:controller.signal});
      const body=await response.json() as {data?:{data:Row[];nextOffset:number|null};error?:{message:string}};
      if(!response.ok||!body.data)throw Error(body.error?.message??"Không thể đọc ảnh chấm công.");
      rows.push(...body.data.data);
      if(body.data.nextOffset===null)break;
      offset=body.data.nextOffset;
      if(i===9)partial=true;
    }
    if(valid)setState({kind:"ready",data:rows,partial});
  })().catch(e=>{if(valid&&!(e instanceof DOMException&&e.name==="AbortError"))
    setState({kind:"error",message:e instanceof Error?e.message:"Không thể tải grid ảnh."});});
  return()=>{valid=false;controller.abort();};
 },[centerId,periodId,staffId]);
 const list=useMemo(()=>{
  if(state.kind!=="ready")return [];
  const byDay=new Map<string,Row[]>();
  for(const row of state.data)byDay.set(row.workDate,[...(byDay.get(row.workDate)??[]),row]);
  const days=[...new Set([...workDates,...state.data.map(r=>r.workDate)])].sort();
  return days.map(day=>({day,sessions:byDay.get(day)??[]}));
 },[state,workDates]);
 useEffect(()=>{
  if(!expanded)return;
  const handle=(e:KeyboardEvent)=>{if(e.key==="Escape")setExpanded(null);};
  document.addEventListener("keydown",handle);
  return()=>document.removeEventListener("keydown",handle);
 },[expanded]);
 const evidence=state.kind==="ready"?state.data:[];
 const captured=evidence.filter(e=>e.photoStatus==="BOUND").length;
 const legacy=evidence.filter(e=>e.photoId===null).length;
 const removed=evidence.filter(e=>e.photoStatus==="DELETED").length;
 return <section className={styles.section} aria-label="Lưới ảnh Check-in">
  <div className={styles.head}>
    <div><h4>Bằng chứng Check-in</h4><p>Xem lướt cả kỳ trước khi chốt · ảnh chụp trực tiếp từ TOS</p></div>
    {state.kind==="ready"?<small>{captured} ảnh · {legacy} thiếu · {removed} đã xóa</small>:null}
  </div>
  {state.kind==="loading"?<p className={styles.info}>Đang tải bằng chứng riêng tư…</p>:null}
  {state.kind==="error"?<p className={styles.error} role="alert">{state.message}</p>:null}
  {state.kind==="ready"?<>
    {state.partial?<p className={styles.error}>Chỉ hiển thị 1.000 bản ghi đầu. Cần lọc kỳ ngắn hơn.</p>:null}
    <div className={styles.grid}>{list.map(item=>item.sessions.length?
      item.sessions.map(row=>{
        const available=row.photoStatus==="BOUND"&&!!row.photoId;
        return <button type="button" className={styles.tile} key={row.sessionId}
          onClick={()=>setExpanded(row)} aria-label={"Ảnh Check-in "+item.day}>
          <div className={styles.thumb}>
            {available?<img src={photoPath(centerId,row.photoId!)} alt="" loading="lazy"/>:
              <span>{row.photoStatus==="DELETED"?"Ảnh đã xóa":"Không có ảnh"}</span>}
          </div>
          <div className={styles.meta}><b>{inCenterDate(item.day)}</b>
            <small>{time(row.checkInAt)} · {available?"Xem ảnh":row.photoStatus==="DELETED"?"Hết hạn lưu":"Kiểm tra ngoại lệ"}</small></div>
        </button>;
      }):
      <div className={styles.tile} key={item.day}>
        <div className={styles.thumb}><span>Không có Check-in</span></div>
        <div className={styles.meta}><b>{inCenterDate(item.day)}</b><small>Đối chiếu Timekeeping</small></div>
      </div>)}</div>
    {!list.length?<p className={styles.info}>Kỳ này chưa có bản ghi Check-in.</p>:null}
    <p className={styles.note}>Ảnh là bằng chứng vận hành, không tự chứng minh vị trí. Các ca cũ hoặc trường hợp không ảnh phải được xem xét thủ công. Xóa ảnh sau 15 ngày kể từ khi chốt riêng nhân viên, giữ nguyên Timekeeping và lương.</p>
  </>:null}
  {expanded?<div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Xem ảnh Check-in">
     <div className={styles.dialog}>
      <div className={styles.dialogHead}><div><strong>{inCenterDate(expanded.workDate)} · {time(expanded.checkInAt)}</strong>
       <small>{expanded.photoStatus==="DELETED"?"Đã xóa ảnh vật lý":"Bằng chứng Check-in của nhân viên"}</small></div>
       <button type="button" onClick={()=>setExpanded(null)} aria-label="Đóng ảnh">✕</button></div>
      {expanded.photoStatus==="BOUND"&&expanded.photoId?
        <img className={styles.full} src={photoPath(centerId,expanded.photoId)} alt="Ảnh Check-in"/>:
        <p className={styles.info}>Không còn ảnh để xem. Dữ liệu giờ công và dấu vết audit vẫn được giữ.</p>}
     </div>
   </div>:null}
 </section>;
}
