"use client";
/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faDesktop, faGear, faHouse, faMagnifyingGlass, faRotate, faStar, faTv, faUsers, faWifi } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import ops from "./ops.module.css";
import {appIcon} from "./identity";
import desk from "./station.module.css";
import {AppNavRail,AppToast,AppPhoneFrame,AppHeader,AppBottomNav} from "../tos-ds";

type Tab = "overview" | "pinoria" | "students" | "devices" | "tv";
const TABS:{id:Tab;label:string;icon:IconDefinition;detail:string}[]=[
  {id:"overview",label:"Tổng quan",icon:faDesktop,detail:"Bảng điều phối"},
  {id:"pinoria",label:"Pinoria",icon:faStar,detail:"House & Wardrobe"},
  {id:"students",label:"Học viên",icon:faUsers,detail:"Tra cứu & trạng thái"},
  {id:"devices",label:"Thiết bị",icon:faGear,detail:"Quản lý node"},
  {id:"tv",label:"TV",icon:faTv,detail:"Nội dung trình chiếu"}
];
const ICON=appIcon("station");
export default function StationDesktopFrame(props:{
 tab:Tab;onTab:(tab:Tab)=>void;onHome:()=>void;onReset:()=>void;centerName:string;desktop:boolean;
 query:string;onQuery:(value:string)=>void;
 notice:string;children:ReactNode;
}){
 const selected=TABS.find(t=>t.id===props.tab)!;
 return <AppPhoneFrame app="station" runtimeApp="station" navigation className={desk.stationFrame}>
   <AppHeader app="station" station={props.centerName} onHome={props.onHome}/>
   <main data-tos-system className={[ops.outer,desk.desktopRoot].join(" ")} data-tos-vnext-station={props.desktop?"desktop":"mobile"}>
   <div className={desk.desktopShell}>
     <aside className={desk.sidebar} aria-label="Thanh bên Trạm TOS">
       <div className={desk.sidebarBrand}><img src={ICON} alt=""/><div><strong>Trạm TOS</strong><small>WORKSTATION · PINO HOUSE</small></div></div>
       <div className={desk.sidebarSection}>KHÔNG GIAN VẬN HÀNH</div>
       <AppNavRail className={desk.sidebarNav} label="Điều hướng Trạm TOS">
         {TABS.map(item=><button type="button" key={item.id} aria-current={props.tab===item.id?"page":undefined} aria-controls="tos-vnext-station-workspace" onClick={()=>props.onTab(item.id)}><FontAwesomeIcon icon={item.icon}/><span><strong>{item.label}</strong><small>{item.detail}</small></span>{props.tab===item.id?<FontAwesomeIcon className={desk.navChevron} icon={faChevronRight}/>:null}</button>)}
       </AppNavRail>
       <div className={desk.sidebarFoot}>
         <div className={desk.nodePanel}><span className={desk.liveDot} data-state="unknown"/><div><strong>Chưa xác minh node</strong><small><FontAwesomeIcon icon={faWifi}/> Chưa có trạng thái kết nối</small></div></div>
         <button type="button" onClick={props.onHome} className={desk.backHome}><FontAwesomeIcon icon={faHouse}/> Trở về TOS Home</button>
       </div>
     </aside>
     <section className={desk.workspace}>
       <header className={desk.topbar}>
         <div className={desk.breadcrumb}><span>Ứng dụng</span><FontAwesomeIcon icon={faChevronRight}/><strong>{selected.label}</strong></div>
         <div className={desk.topbarRight}>
           <div className={desk.stationCenter}>{props.centerName} <span>·</span> Trạm TOS</div>
           <label className={desk.quickSearch}><FontAwesomeIcon icon={faMagnifyingGlass}/><input placeholder="Tìm học viên…" aria-label="Tìm học viên tại trạm" value={props.query} onChange={e=>{props.onQuery(e.target.value);props.onTab("students");}} /></label>
           <button className={desk.iconAction} type="button" disabled title="Chưa có contract đồng bộ trạm" aria-label="Tải lại dữ liệu trạm" onClick={props.onReset}><FontAwesomeIcon icon={faRotate}/></button>
         </div>
       </header>
       <div className={desk.workspaceContent}>
         <div className={desk.pageIntro}><div><span className={desk.pageKicker}>TRẠM TOS · {selected.detail.toUpperCase()}</span><h1>{selected.label}</h1></div><span className={desk.demoChip}>CHƯA XÁC MINH DỮ LIỆU TRẠM</span></div>
         {props.tab==="students"&&<label className={desk.mobileSearch}><FontAwesomeIcon icon={faMagnifyingGlass}/><input placeholder="Tìm học viên…" aria-label="Tìm học viên tại trạm" value={props.query} onChange={e=>props.onQuery(e.target.value)}/></label>}
         <div id="tos-vnext-station-workspace" className={desk.viewBody}>{props.children}</div>
       </div>
     </section>
   </div>
   {props.notice?<AppToast message={props.notice} className={[ops.toast,desk.toast].join(" ")}/>:null}
 </main>
   <div className={desk.mobileNav}><AppBottomNav items={TABS.map(({id,label})=>({id,label,icon:null}))} active={props.tab} onChange={id=>{props.onTab(id as Tab);window.scrollTo({top:0});}} label="Điều hướng Trạm TOS"/></div>
 </AppPhoneFrame>;
}
