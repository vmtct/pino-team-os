"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCamera, faCheck, faChevronRight, faDoorOpen, faHeart, faHouse, faMagnifyingGlass, faShieldHalved, faStar, faUserCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import { OpsFrame, type OpsTab } from "./OpsV4Body";
import {Initials} from "./OpsInitials";
import ReceptionOpenShift from "./ReceptionV4OpenShift";

import {unavailableOpsReadModel,type OpsReadModel,type ArrivalStatus} from "@/lib/tos-ops-v4-view-model";
import css from "./ops.module.css";
import {AppSheet} from "../tos-ds";

type Tab = "overview" | "arrivals" | "pinoria";
const TABS: OpsTab[] = [
  { id:"overview", label:"Hôm nay", icon:faHouse },
  { id:"arrivals", label:"Đón / Trả", icon:faUserCheck },
  { id:"pinoria", label:"Pinoria", icon:faStar },
];
const labels:Record<ArrivalStatus,string>={EXPECTED:"Chưa đến",ARRIVED:"Đang ở PINO",LEFT:"Đã về"};
export default function ReceptionV4Presentation({centerName,profileLabel,workDate,shiftTime,visitLookup,model=unavailableOpsReadModel(),initialTab="overview",initialReadOnly=false}:{centerName:string;profileLabel:string;workDate:string;shiftTime:string;visitLookup?:ReactNode;model?:OpsReadModel;initialTab?:Tab;initialReadOnly?:boolean}){
  const state=model,guests=model.guests;
  const [readOnly,setReadOnly]=useState(initialReadOnly);
  const [tab,setTab]=useState<Tab>(initialTab);
  const [filter,setFilter]=useState<"ALL"|ArrivalStatus>("ALL");
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [guardianConfirmed,setGuardianConfirmed]=useState(false);
  const [notice,setNotice]=useState("");
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(""),2900);return()=>window.clearTimeout(timer);},[notice]);
  const counts=useMemo(()=>{
    const values=guests.map(g=>state.attendance[g.id]);
    return {EXPECTED:values.filter(v=>v==="EXPECTED").length,ARRIVED:values.filter(v=>v==="ARRIVED").length,LEFT:values.filter(v=>v==="LEFT").length};
  },[state.attendance]);
  const results=guests.filter(g=>(filter==="ALL"||state.attendance[g.id]===filter)&&(g.name+" "+g.className+" "+g.room).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const selected=guests.find(g=>g.id===selectedId);
  const pendingWishes=guests.filter(g=>Object.prototype.hasOwnProperty.call(state.wishes,g.id)&&!state.wishes[g.id]);
  function openFilter(value:ArrivalStatus){setFilter(value);setQuery("");setTab("arrivals");}
  function closeDetail(){setSelectedId(null);setGuardianConfirmed(false);}
  function openDetail(id:string){setSelectedId(id);setGuardianConfirmed(false);}
  if(!readOnly)return <ReceptionOpenShift centerName={centerName} shiftTime={shiftTime} onBypass={()=>setReadOnly(true)}/>;
  return <OpsFrame app="reception" title="Tiếp Tân" tabs={TABS} tab={tab} onTab={value=>setTab(value as Tab)} notice={notice}>
    {tab==="overview"&&<>
      <div className={css.intro}><span className={css.eyebrow}>{workDate}</span><h2 className={css.title}>Xin chào, {profileLabel||"bạn"} 👋</h2><p className={css.lead}>Học viên đến và về trong ca trực hôm nay.</p></div>
      <div className={css.openedStrip}><div><strong>Đang xem quầy · Chưa xác nhận mở ca</strong><small>{centerName} · {shiftTime}</small></div><button className={css.photoBadge} type="button" onClick={()=>setReadOnly(false)}><FontAwesomeIcon icon={faCamera}/> Ảnh setup</button></div>
      <div className={css.stats} aria-label="Tình trạng học viên hôm nay">
        <button type="button" className={css.stat} onClick={()=>openFilter("EXPECTED")} aria-label={"Xem "+(model.loaded?counts.EXPECTED:"chưa xác minh")+" học viên chưa đến"}><strong>{model.loaded?counts.EXPECTED:"—"}</strong><span>Chưa đến <FontAwesomeIcon icon={faChevronRight}/></span></button>
        <button type="button" className={css.stat} onClick={()=>openFilter("ARRIVED")} aria-label={"Xem "+(model.loaded?counts.ARRIVED:"chưa xác minh")+" học viên đang ở PINO"}><strong>{model.loaded?counts.ARRIVED:"—"}</strong><span>Đang ở PINO <FontAwesomeIcon icon={faChevronRight}/></span></button>
        <button type="button" className={css.stat} onClick={()=>openFilter("LEFT")} aria-label={"Xem "+(model.loaded?counts.LEFT:"chưa xác minh")+" học viên đã về"}><strong>{model.loaded?counts.LEFT:"—"}</strong><span>Đã về <FontAwesomeIcon icon={faChevronRight}/></span></button>
      </div>
      <section className={css.actionGrid}>
        <button className={css.actionTile} onClick={()=>{setTab("arrivals");setFilter("ALL");setQuery("");}}><FontAwesomeIcon icon={faUserCheck}/><strong>Đón / Trả học viên</strong><small>Xác nhận đến và bàn giao</small></button>
        <button className={css.actionTile} onClick={()=>setTab("pinoria")}><FontAwesomeIcon icon={faStar}/><strong>Wish Pinoria</strong><small>{model.loaded?pendingWishes.length:"—"} yêu cầu đang chờ</small></button>
      </section>
      <section className={css.panel}><div className={css.panelTitle}><h3>Hoạt động trong ca</h3><span>{model.loaded?"Trong ca":"Chưa tải được"}</span></div>
        <div className={css.activity}>{state.events.slice(0,5).map(x=><div className={css.activityItem} key={x.id}><i className={css.activityDot}/><span>{x.text}</span><small>{x.time}</small></div>)}</div>
      </section>
      <div className={css.callout}><strong><FontAwesomeIcon icon={faShieldHalved}/> Bàn giao an toàn</strong><span>Xác minh trực tiếp người đón trước khi checkout. Thao tác bàn giao chưa khả dụng khi chưa xác minh quyền và danh tính người đón.</span></div>

    </>}
    {tab==="arrivals"&&<>
      <div className={css.intro}><span className={css.eyebrow}>ĐÓN / TRẢ · {centerName}</span><h2 className={css.title}>Danh sách hôm nay</h2><p className={css.lead}>Chọn học viên để ghi nhận đã đến hoặc xác nhận bàn giao.</p></div>
      {visitLookup}
      <div className={css.search}><FontAwesomeIcon icon={faMagnifyingGlass}/><input className={css.input} placeholder="Tìm tên, lớp hoặc phòng…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className={css.filters}>{([["ALL","Tất cả"],["EXPECTED","Chưa đến"],["ARRIVED","Đang ở PINO"],["LEFT","Đã về"]] as const).map(([value,label])=><button type="button" key={value} className={css.filter} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
      <section className={css.panel}><div className={css.panelTitle}><h3>Học viên</h3><span>{model.loaded?results.length:"—"} kết quả</span></div>
        {results.length?<div className={css.list}>{results.map(g=><button type="button" className={css.listRow+" "+css.listRowButton} key={g.id} onClick={()=>openDetail(g.id)}>
          <Initials text={g.initials}/><div className={css.rowCopy}><strong>{g.name}</strong><small>{g.classTime} · {g.className}</small><small>{g.room}</small></div>
          <span className={css.badge} data-state={state.attendance[g.id]}>{labels[state.attendance[g.id]]}</span><FontAwesomeIcon className={css.chevron} icon={faChevronRight}/>
        </button>)}</div>:<div className={css.empty}>{model.loaded?"Không có học viên phù hợp với bộ lọc.":"Chưa tải được danh sách đón / trả."}</div>}
      </section>
    </>}
    {tab==="pinoria"&&<>
      <div className={css.intro}><span className={css.eyebrow}>PINORIA · TIẾP TÂN</span><h2 className={css.title}>Wish đang chờ</h2><p className={css.lead}>Hỗ trợ các yêu cầu tương tác Pinoria tại quầy.</p></div>
      <div className={css.stats}><div className={css.stat}><strong>{model.loaded?pendingWishes.length:"—"}</strong><span>Wish chờ</span></div><div className={css.stat}><strong>{model.loaded?Object.values(state.wishes).filter(Boolean).length:"—"}</strong><span>Đã hỗ trợ</span></div><div className={css.stat}><strong>—</strong><span>Region chưa xác minh</span></div></div>
      <section className={css.panel}><div className={css.panelTitle}><h3>Yêu cầu Pinoria</h3><span>Chưa xác minh Region</span></div>
        <div className={css.list}>{guests.filter(g=>Object.prototype.hasOwnProperty.call(state.wishes,g.id)).map(g=><div className={css.listRow} key={g.id}><Initials text={g.initials}/><div className={css.rowCopy}><strong>{g.name}</strong><small>Wish · tương tác Pinoria</small><span className={css.badge} data-state={state.wishes[g.id]?"done":"waiting"}>{state.wishes[g.id]?"Đã hỗ trợ":"Đang chờ"}</span></div><button className={css.secondary} disabled title="Chưa xác minh command Wish">{state.wishes[g.id]?"✓":"Xử lý"}</button></div>)}</div>
      </section>
      <div className={css.callout}><strong><FontAwesomeIcon icon={faHeart}/> Thao tác chưa khả dụng</strong><span>Wish chỉ được xử lý sau khi có quyền và xác nhận từ hệ thống.</span></div>
      <button className={css.secondary} onClick={()=>setNotice("Trạm TOS mở riêng từ TOS Home trên desktop.")}>Trạm TOS là ứng dụng desktop <FontAwesomeIcon icon={faArrowRight}/></button>
    </>}
    {selected&&<AppSheet title="Hồ sơ Đón / Trả" onClose={closeDetail}>
        <div className={css.row}><Initials text={selected.initials}/><div className={css.rowCopy}><strong className={css.selectedGuestName}>{selected.name}</strong><small>{selected.className}</small></div><span className={css.badge} data-state={state.attendance[selected.id]}>{labels[state.attendance[selected.id]]}</span></div>
        <div className={css.kv}><div><span>Lịch học</span><strong>{selected.classTime}</strong></div><div><span>Phòng</span><strong>{selected.room}</strong></div><div><span>Người đón</span><strong>{selected.guardian}</strong></div><div><span>Trạng thái</span><strong>{labels[state.attendance[selected.id]]}</strong></div></div>
        {state.attendance[selected.id]==="EXPECTED"&&<><div className={css.callout}>Chỉ ghi nhận đã đến khi học viên thực sự có mặt tại quầy.</div><button className={css.primary} disabled><FontAwesomeIcon icon={faDoorOpen}/> Xác nhận đã đến</button></>}
        {state.attendance[selected.id]==="ARRIVED"&&<><div className={css.callout}><strong><FontAwesomeIcon icon={faShieldHalved}/> Xác minh người đón</strong><span>Người đón: {selected.guardian}. Bắt buộc xác minh trực tiếp và được hệ thống cho phép.</span></div>
          <label className={css.fieldLabel}><span><input type="checkbox" checked={guardianConfirmed} onChange={e=>setGuardianConfirmed(e.target.checked)}/> Đã xác minh người đón</span></label>
          <button className={css.primary} disabled><FontAwesomeIcon icon={faCheck}/> Checkout & bàn giao</button></>}
        {state.attendance[selected.id]==="LEFT"&&<div className={css.callout}><strong>Đã bàn giao và rời PINO House</strong></div>}
    </AppSheet>}
  </OpsFrame>;
}
