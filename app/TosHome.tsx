"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faGear, faCalendarDays, faDesktop, faClock, faLocationDot, faLock, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { shortDisplayName } from "@/lib/display-name";
import { workforceApi, type Assignment, type WorkforceContext, type StaffProfile } from "@/lib/workforce-api";
import styles from "./tos-home-v2.module.css";

const R2_BASE = process.env.NEXT_PUBLIC_TOS_ASSET_BASE ?? "https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev";
const APPS: { id:string; title:string; asset:string; fallback:IconDefinition; tone:string; href?:string }[] = [
  { id:"shift", title:"Ca làm", asset:"shift.png", fallback:faCalendarDays, tone:"blue", href:"/dashboard" },
  { id:"reception", title:"Tiếp tân", asset:"frontdesk.png", fallback:faLocationDot, tone:"blue" },
  { id:"station", title:"Trạm TOS", asset:"tosStation.png", fallback:faDesktop, tone:"violet" },
  { id:"shift-lead", title:"Trưởng ca", asset:"shiftlead.png", fallback:faClock, tone:"coral" },
  { id:"classroom", title:"Lớp học", asset:"class.png", fallback:faCalendarDays, tone:"green" },
];
function centerDate(timeZone:string, date:Date) {
  return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function relevantAssignment(rows:Assignment[], today:string) {
  return rows.filter(a=>a.status!=="CANCELLED" && a.workDate>=today).sort((a,b)=>a.workDate.localeCompare(b.workDate) || (a.effectiveStartLocal??a.shift?.startLocalTime??"").localeCompare(b.effectiveStartLocal??b.shift?.startLocalTime??""))[0] ?? null;
}
function Tile({app,enabled,onClick}:{app:typeof APPS[number];enabled:boolean;onClick:()=>void}) {
 const [failed,setFailed]=useState(false);
 return <button type="button" className={`${styles.appTile} ${styles[app.tone]} ${!enabled?styles.disabled:""}`} aria-disabled={!enabled} aria-label={enabled?`Mở ${app.title}`:`${app.title} chưa có quyền`} onClick={onClick}>
   <span className={styles.iconFrame}>{!failed?<img src={`${R2_BASE}/AppIcon/${app.asset}`} className={styles.appImage} alt="" onError={()=>setFailed(true)}/>:<span className={styles.iconFallback}><FontAwesomeIcon icon={app.fallback}/></span>}{!enabled?<span className={styles.lockBadge}><FontAwesomeIcon icon={faLock}/></span>:null}</span>
   <span className={styles.appLabel}>{app.title}</span>
 </button>;
}
export default function TosHome() {
 const router=useRouter();
 const [profile,setProfile]=useState<StaffProfile|null>(null);
 const [context,setContext]=useState<WorkforceContext|null>(null);
 const [assignment,setAssignment]=useState<Assignment|null>(null);
 const [centerName,setCenterName]=useState("");
 const [notice,setNotice]=useState("");
 const [desktop,setDesktop]=useState(false);
 const [backgroundReady,setBackgroundReady]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
   let live=true;
   const media=window.matchMedia("(min-width: 760px)");
   const update=()=>setDesktop(media.matches);update();media.addEventListener("change",update);
   const img=new Image();img.onload=()=>{if(live)setBackgroundReady(true)};img.onerror=()=>{if(live)setBackgroundReady(false)};img.src=`${R2_BASE}/Background.jpg`;
   void Promise.allSettled([workforceApi.profile(),workforceApi.context()]).then(async results=>{
     if(!live)return;
     if(results[0].status==="fulfilled")setProfile(results[0].value.data);
     if(results[1].status==="fulfilled"){
       const ctx=results[1].value.data;setContext(ctx);
       const center=ctx.centers[0];
       if(center){
         setCenterName(center.displayName);
         const zone=center.timeZone||"Asia/Ho_Chi_Minh";
         const today=centerDate(zone,new Date());
         const future=new Date();future.setUTCDate(future.getUTCDate()+14);
         try{
           const scheduled=await workforceApi.schedule({centerId:center.id,startDate:today,endDate:centerDate(zone,future)});
           if(live)setAssignment(relevantAssignment(scheduled.data,today));
         }catch{if(live)setNotice("Không thể tải lịch ca hiện tại.");}
       }
     }
     if(live)setLoading(false);
   });
   return()=>{live=false;media.removeEventListener("change",update)};
 },[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(""),2600);return()=>clearTimeout(t)},[notice]);
 const name=shortDisplayName(profile?.displayLabel)||"bạn";
 const shiftTime=assignment?(assignment.effectiveStartLocal&&assignment.effectiveEndLocal?`${assignment.effectiveStartLocal.slice(0,5)}–${assignment.effectiveEndLocal.slice(0,5)}`:assignment.shift?`${assignment.shift.startLocalTime.slice(0,5)}–${assignment.shift.endLocalTime.slice(0,5)}`:"Chưa rõ giờ"):"";
 const openApp=(id:string,href?:string,enabled=false)=>{if(!enabled){setNotice("Ca này bạn chưa có quyền");return;}if(href)router.push(href);else setNotice("Ứng dụng chưa sẵn sàng.");};
 return <main className={styles.screen}>
   <div className={`${styles.background} ${backgroundReady?styles.backgroundLoaded:""}`} style={backgroundReady?{backgroundImage:`url("${R2_BASE}/Background.jpg")`}:undefined} aria-hidden="true"/>
   <div className={styles.content}>
     <header className={styles.header}>
       <div className={styles.greeting}><div className={styles.avatar}>{Array.from(name)[0]?.toUpperCase()??"P"}</div><div><span className={styles.kicker}>PINO · TEAM OPS</span><h1>Xin chào, {name}</h1></div></div>
       <div className={styles.headerActions}><button type="button" className={styles.headerButton} aria-label="Thông báo chưa sẵn sàng" onClick={()=>setNotice("Thông báo chưa sẵn sàng.")}><FontAwesomeIcon icon={faBell}/></button><button type="button" className={styles.headerButton} aria-label="Mở hồ sơ" onClick={()=>router.push("/info")}><FontAwesomeIcon icon={faGear}/></button></div>
     </header>
     <button type="button" className={styles.shiftCard} onClick={()=>router.push("/dashboard")}>
       <div className={styles.shiftTopline}><span className={styles.statusDot}/><strong>{loading?"Đang tải ca":assignment?"Ca được phân công":"Chưa có ca sắp tới"}</strong><span className={styles.shiftTime}>{shiftTime}</span><FontAwesomeIcon className={styles.shiftChevron} icon={faChevronRight}/></div>
       <div className={styles.shiftPlace}><FontAwesomeIcon icon={faLocationDot}/><span>{centerName||"Chưa xác định trung tâm"}</span>{assignment?<><span className={styles.separator}>·</span><span>{assignment.shift?.displayLabel||assignment.workDate}</span></>:null}<span>{assignment?" · Vai trò ca chưa khả dụng":context?"":" · Đang tải dữ liệu"}</span></div>
     </button>
     <section className={styles.appsSection} aria-label="Ứng dụng PINO"><div className={styles.sectionHeading}><h2>Ứng dụng</h2><span>5 apps</span></div><div className={styles.appGrid}>{APPS.map(app=><Tile key={app.id} app={app} enabled={app.id==="shift" || (app.id==="station" && desktop)} onClick={()=>openApp(app.id,app.href,app.id==="shift" || (app.id==="station" && desktop))}/>)}</div></section>
     <footer className={styles.footer}><span className={styles.footerPill}>PINO TEAM</span><span>{desktop?"Desktop":"Mobile-first"}</span></footer>
   </div>
   {notice?<div className={styles.toast} role="status"><FontAwesomeIcon icon={faLock}/><span>{notice}</span></div>:null}
 </main>;
}
