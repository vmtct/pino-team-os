"use client";
/**
 * PAP-940: VNext Home presentation only, using the Founder-approved TOS Home
 * layout rather than copying prototype-only CSS. Core owns all permissions.
 * The caller must enforce app access again before routing/opening a feature.
 */
import {useEffect,useState} from "react";
import type {Assignment} from "@/lib/workforce-api";
import {shortDisplayName} from "@/lib/display-name";
import {LogoutButton} from "@/app/components/tos-shell/LogoutButton";
import {SupportSessionBanner} from "@/app/components/tos-shell/SupportSessionBanner";
import {APP_ICON_BASE,SIX_TOS_APPS,appIcon,type TosVNextAppId} from "./identity";
import home from "@/app/tos-home-v2.module.css";
import shell from "./tos-vnext.module.css";

type HomeProps={
 profileLabel?:string|null;
 centerName?:string|null;
 authorizedCenters:readonly {id:string;displayName:string}[];
 selectedCenterId:string;
 onCenterChange:(centerId:string)=>void;
 nextAssignment?:Assignment|null;
 busy:boolean;
 allowed:(app:TosVNextAppId)=>boolean;
 onOpen:(app:TosVNextAppId)=>void;
 onNotify:()=>void;
 notice?:string;
};
const backBase=APP_ICON_BASE.replace(/\/$/,"");
function shiftHours(assignment:Assignment|null|undefined){
 if(!assignment)return "";
 const time=(iso:string|null|undefined)=>iso?.split("T").at(-1)?.slice(0,5)||"";
 const start=time(assignment.effectiveStartLocal)||time(assignment.shift?.startLocalTime);
 const end=time(assignment.effectiveEndLocal)||time(assignment.shift?.endLocalTime);
 return start&&end?`${start}–${end}`:"";
}
export function TosVNextHome({profileLabel,centerName,authorizedCenters,selectedCenterId,onCenterChange,nextAssignment,busy,allowed,onOpen,onNotify,notice}:HomeProps){
 const [backgroundReady,setBackgroundReady]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [broken,setBroken]=useState<Partial<Record<TosVNextAppId,boolean>>>({});
 useEffect(()=>{
  let live=true;
  const img=new Image();
  img.onload=()=>{if(live)setBackgroundReady(true)};
  img.onerror=()=>{if(live)setBackgroundReady(false)};
  img.src=backBase+"/Background.jpg";
  return()=>{live=false};
 },[]);
 const name=shortDisplayName(profileLabel)||"bạn";
 const shiftText=shiftHours(nextAssignment);
 return <main className={home.screen} data-tos-vnext-home="six-apps">
  <SupportSessionBanner />
  <div className={`${home.background} ${backgroundReady?home.backgroundLoaded:""}`}
   style={backgroundReady?{backgroundImage:`url("${backBase}/Background.jpg")`}:undefined} aria-hidden="true"/>
  <div className={home.content}>
   <header className={home.header}>
    <div className={home.greeting}>
     <span className={home.avatar}>{Array.from(name)[0]?.toUpperCase()??"P"}</span>
     <div><span className={home.kicker}>PINO · TEAM OPS</span><h1>Xin chào, {name}</h1></div>
    </div>
    <div className={home.headerActions}>
     <button type="button" className={home.headerButton} aria-label="Thông báo"
      onClick={onNotify}>♧</button>
     <button type="button" className={home.headerButton} aria-label="Cài đặt"
      aria-expanded={settingsOpen} aria-controls="tos-vnext-home-settings" onClick={()=>setSettingsOpen(v=>!v)}>⚙</button>
    </div>
   </header>
   {settingsOpen&&<section id="tos-vnext-home-settings" aria-label="Cài đặt" className={shell.homeSettingsMenu}>
    <span>{profileLabel||"Tài khoản TOS"}</span>
    {authorizedCenters.length>1&&<label className={shell.homeCenterLabel}>Trung tâm
     <select value={selectedCenterId} disabled={busy} onChange={e=>{onCenterChange(e.target.value);setSettingsOpen(false)}}>
      {authorizedCenters.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
     </select>
    </label>}
    <LogoutButton className={shell.homeLogout}/>
   </section>}
   <button type="button" className={home.shiftCard} disabled={busy||!allowed("shift")}
    aria-label={busy||!allowed("shift")?"Chưa xác minh lịch ca":"Mở Ca Làm"}
    onClick={()=>onOpen("shift")}>
    <span className={home.shiftTopline}><span className={home.statusDot}/>
     <strong>{busy?"Đang tải ca":nextAssignment?"Ca được phân công":"Chưa có ca sắp tới"}</strong>
     <b className={home.shiftTime}>{shiftText}</b><span className={home.shiftChevron}>›</span>
    </span>
    <span className={home.shiftPlace}>⌖ &nbsp; {centerName||"Chưa xác định trung tâm"}
     {nextAssignment&&<><span className={home.separator}>·</span>{nextAssignment.shift?.displayLabel||nextAssignment.workDate}</>}
    </span>
   </button>
   <section className={home.appsSection} aria-label="Ứng dụng PINO">
    <div className={home.sectionHeading}><h2>Ứng dụng</h2><span>{SIX_TOS_APPS.length} apps</span></div>
    <div className={home.appGrid}>
     {SIX_TOS_APPS.map(app=>{
      const enabled=!busy&&allowed(app.id);
      return <button key={app.id} type="button" className={`${home.appTile} ${!enabled?home.disabled:""}`}
       aria-disabled={!enabled} aria-label={enabled?`Mở ${app.title}`:`${app.title} chưa có quyền`}
       onClick={()=>onOpen(app.id)}>
       <span className={home.iconFrame}>
        {!broken[app.id]?
         // eslint-disable-next-line @next/next/no-img-element
         <img className={home.appImage} src={appIcon(app.id)} alt=""
          onError={()=>setBroken(old=>({...old,[app.id]:true}))}/>:
         <span className={shell.homeIconFallback} aria-hidden="true">{app.title.slice(0,1)}</span>}
        {!enabled&&<span className={home.lockBadge} aria-hidden="true">⌑</span>}
       </span>
       <span className={home.appLabel}>{app.title}</span>
      </button>;
     })}
    </div>
   </section>
   <footer className={home.footer}><span className={home.footerPill}>PINO TEAM</span><span>Team Operations</span></footer>
  </div>
  {notice&&<div className={home.toast} role="status" aria-live="polite">{notice}</div>}
 </main>;
}
