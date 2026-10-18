"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { boApi } from "@/lib/bo-api";
import { parentApi, ParentApiError, type ParentAuditEvent, type ParentDetail, type ParentDirectoryRow, type ParentContactKind, type GuardianRole } from "@/lib/bo-parent-guardian";
import styles from "./bo-parents.module.css";
type Load<T>={state:"loading"}|{state:"error";message:string}|{state:"ready";data:T};
type Tab="overview"|"students"|"contacts"|"audit";
type Mode="create"|"rename"|"contact"|"link"|"unlink"|"retire"|null;
const err=(e:unknown)=>e instanceof Error?e.message:"Không thể tải dữ liệu";
export function BoParentsView(){
  const [search,setSearch]=useState("");
  const [rows,setRows]=useState<Load<ParentDirectoryRow[]>>({state:"loading"});
  const [cursor,setCursor]=useState<string|null>(null);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [detail,setDetail]=useState<Load<ParentDetail>|null>(null);
  const [tab,setTab]=useState<Tab>("overview");
  const [audit,setAudit]=useState<Load<ParentAuditEvent[]>|null>(null);
  const [mode,setMode]=useState<Mode>(null);
  const [target,setTarget]=useState("");
  const [name,setName]=useState("");
  const [kind,setKind]=useState<ParentContactKind>("PHONE");
  const [value,setValue]=useState("");
  const [role,setRole]=useState<GuardianRole>("PARENT");
  const [students,setStudents]=useState<Array<{id:string;displayName:string}>>([]);
  const [studentQuery,setStudentQuery]=useState("");
  const [reason,setReason]=useState("");const [ack,setAck]=useState(false);
  const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const epoch=useRef(0);const detailEpoch=useRef(0);
  const refresh=useCallback(async(q:string,c:string|null)=>{
    const n=++epoch.current;setRows({state:"loading"});
    try{const page=await parentApi.list(q,c??undefined);if(n===epoch.current){setRows({state:"ready",data:page.items});setNextCursor(page.nextCursor);}}
    catch(e){if(n===epoch.current)setRows({state:"error",message:err(e)});}
  },[]);
  const refreshDetail=useCallback(async(id:string)=>{
    const n=++detailEpoch.current;setDetail({state:"loading"});
    try{const data=await parentApi.detail(id);if(n===detailEpoch.current)setDetail({state:"ready",data});}
    catch(e){if(n===detailEpoch.current)setDetail({state:"error",message:err(e)});}
  },[]);
  useEffect(()=>{void refresh(search,cursor);},[search,cursor,refresh]);
  useEffect(()=>{if(selected)void refreshDetail(selected);else {detailEpoch.current++;setDetail(null);}},[selected,refreshDetail]);
  useEffect(()=>{if(tab!=="audit"||!selected)return;let active=true;setAudit({state:"loading"});
    void parentApi.audit(selected).then(data=>{if(active)setAudit({state:"ready",data});}).catch(e=>{if(active)setAudit({state:"error",message:err(e)});});
    return()=>{active=false;};},[selected,tab]);
  useEffect(()=>{if(mode!=="link"||studentQuery.trim().length<3){setStudents([]);return;}
    let active=true;void boApi.learners(studentQuery,20).then(data=>{if(active)setStudents(data.map(s=>({id:s.id,displayName:s.displayName})));}).catch(()=>{if(active)setStudents([]);});
    return()=>{active=false;};},[mode,studentQuery]);
  const columns=useMemo<BoDataGridColumn<ParentDirectoryRow>[]>(()=>[
    {key:"name",header:"Phụ huynh",minWidth:220,render:p=><div className={styles.stack}><strong>{p.displayName}</strong><BoDataGridCanonicalId value={p.id} label="Parent ID"/></div>},
    {key:"contact",header:"Liên hệ (masked)",render:p=>p.maskedContact??"Chưa có"},
    {key:"students",header:"Học viên",render:p=>p.linkedStudentCount},
    {key:"attention",header:"Đối soát",render:p=><BoDataGridStatus value={p.attention==="MISSING_CONTACT"?"Thiếu liên hệ":p.attention==="NO_STUDENT"?"Chưa liên kết":"Đủ thông tin"} tone={p.attention?"warning":"success"}/>},
  ],[]);
  const current=detail?.state==="ready"?detail.data:null;
  function begin(next:Exclude<Mode,null>,linkId=""){
    setMode(next);setTarget(linkId);setName(next==="rename"&&current?current.displayName:"");
    setReason("");setValue("");setAck(false);setError("");setStudentQuery("");
  }
  function close(){if(mode&&(name||value||reason)&&!window.confirm("Bỏ thay đổi chưa lưu?"))return;setMode(null);setSelected(null);}
  async function submit(){
    if(!ack||reason.trim().length<8){setError("Nhập lý do ít nhất 8 ký tự và xác nhận.");return;}
    if(!mode||pending)return;setPending(true);setError("");
    try{
      let id=selected;
      if(mode==="create"){if(name.trim().length<3)throw new Error("Thiếu tên Parent");const result=await parentApi.create(name.trim(),value.trim()?{type:kind,value:value.trim()}:undefined,reason.trim());id=result.parentId;}
      else if(!id||!current)throw new Error("Chưa tải hồ sơ Parent");
      else if(mode==="rename")await parentApi.rename(id,name.trim(),current.version,reason.trim());
      else if(mode==="contact")await parentApi.addContact(id,kind,value.trim(),reason.trim());
      else if(mode==="retire")await parentApi.retireContact(id,target,reason.trim());
      else if(mode==="link"){if(!target)throw new Error("Chọn học viên");await parentApi.link(id,target,role,reason.trim());}
      else if(mode==="unlink"){const link=current.students.find(s=>s.id===target);if(!link)throw new Error("Liên kết đã thay đổi");await parentApi.unlink(id,target,link.version,reason.trim());}
      setMode(null);setName("");setReason("");setAck(false);await refresh(search,cursor);
      if(id){setSelected(id);await refreshDetail(id);}
    }catch(e){setError(e instanceof ParentApiError&&e.status===409?"409 · Dữ liệu đã thay đổi, vui lòng tải lại.":err(e));}
    finally{setPending(false);}
  }
  return <main className={styles.page}>
    <header className={styles.heading}><div><span>School · Identity</span><h1>Parents & Guardians</h1><p>Liên kết hiện tại là dữ liệu gốc. Audit là nơi duy nhất tra cứu lịch sử.</p></div><button type="button" className={styles.primary} onClick={()=>{setSelected(null);begin("create");}}>+ Thêm Parent</button></header>
    <BoDataGrid rows={rows.state==="ready"?rows.data:[]} columns={columns} rowKey={p=>p.id} caption="Parent directory · scoped and masked" state={rows.state} stateMessage={rows.state==="error"?rows.message:undefined} search={search} onSearchChange={q=>{setCursor(null);setSearch(q);}} searchPlaceholder="Tìm tên hoặc Parent ID..." onRowOpen={p=>{setSelected(p.id);setTab("overview");setMode(null);}} selectedRowKey={selected} resultLabel={rows.state==="ready"?`${rows.data.length} hồ sơ`:"Đang tải"} toolbarActions={<div className={styles.actions}><button onClick={()=>void refresh(search,cursor)}>Tải lại</button><button disabled={!cursor} onClick={()=>setCursor(null)}>← Đầu</button><button disabled={!nextCursor} onClick={()=>setCursor(nextCursor)}>Tiếp →</button></div>} emptyTitle="Không có Parent phù hợp" emptyMessage="Danh bạ được lọc theo quyền Center ở Core."/>
    {(selected||mode==="create")&&<BoDataGridSidePeek title={mode==="create"?"Thêm Parent":current?.displayName??"Parent"} eyebrow="School · Parents & Guardians" onClose={close}>
      {mode?<form className={styles.form} onSubmit={e=>{e.preventDefault();void submit();}}>
        <h3>{({create:"Thêm phụ huynh",rename:"Sửa tên",contact:"Thêm liên hệ",link:"Liên kết học viên",unlink:"Ngừng liên kết",retire:"Ngừng sử dụng liên hệ"})[mode]}</h3>
        {(mode==="create"||mode==="rename")&&<label>Họ tên *<input value={name} onChange={e=>setName(e.target.value)} minLength={3} required/></label>}
        {(mode==="create"||mode==="contact")&&<><label>Loại liên hệ<select value={kind} onChange={e=>setKind(e.target.value as ParentContactKind)}><option value="PHONE">Phone</option><option value="EMAIL">Email</option></select></label><label>Liên hệ<input value={value} onChange={e=>setValue(e.target.value)} required={mode==="contact"}/></label></>}
        {mode==="link"&&<><label>Tìm học viên (3 ký tự)<input value={studentQuery} onChange={e=>{setStudentQuery(e.target.value);setTarget("");}}/></label><label>Học viên<select value={target} onChange={e=>setTarget(e.target.value)} required><option value="">Chọn học viên</option>{students.map(s=><option value={s.id} key={s.id}>{s.displayName}</option>)}</select></label><label>Vai trò<select value={role} onChange={e=>setRole(e.target.value as GuardianRole)}><option>PARENT</option><option>GUARDIAN</option><option>OTHER</option></select></label></>}
        <label>Lý do *<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={8} required/></label>
        <label className={styles.ack}><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> Xác nhận thay đổi đúng hồ sơ.</label>
        {error&&<p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button type="button" onClick={()=>setMode(null)}>Hủy</button><button type="submit" className={styles.primary} disabled={pending}>{pending?"Đang lưu…":"Lưu"}</button></div>
      </form>:detail?.state==="loading"?<p>Đang tải…</p>:detail?.state==="error"?<p role="alert">{detail.message}</p>:current?<div className={styles.detail}>
        <nav className={styles.tabs} aria-label="Parent tabs">{(["overview","students","contacts","audit"] as Tab[]).map(t=><button key={t} aria-current={tab===t?"page":undefined} onClick={()=>setTab(t)}>{({overview:"Tổng quan",students:"Học viên",contacts:"Liên hệ",audit:"Audit"})[t]}</button>)}</nav>
        {tab==="overview"&&<div className={styles.card}><strong>{current.displayName}</strong><small>Parent ID: {current.id} · version {current.version}</small><small>{current.students.length} học viên đang liên kết</small>{current.access.canManage&&<button onClick={()=>begin("rename")}>Sửa tên</button>}</div>}
        {tab==="students"&&<><div className={styles.actions}><strong>Học viên liên kết</strong>{current.access.canManage&&<button onClick={()=>begin("link")}>+ Liên kết</button>}</div>{current.students.map(s=><div className={styles.card} key={s.id}><strong>{s.studentName}</strong><small>{s.centerName} · {s.role}</small>{current.access.canManage&&<button onClick={()=>begin("unlink",s.id)}>Ngừng liên kết</button>}</div>)}{!current.students.length&&<p>Chưa có học viên liên kết.</p>}</>}
        {tab==="contacts"&&<><div className={styles.actions}><strong>Liên hệ hiện tại</strong>{current.access.canManage&&<button onClick={()=>begin("contact")}>+ Thêm</button>}</div>{current.contacts.map(c=><div className={styles.card} key={c.id}><strong>{c.maskedValue}</strong><small>{c.type} · {c.verified?"Đã xác minh":"Chưa xác minh"}</small><button disabled title="Core PII reveal permission and command chưa hoàn thiện">Reveal</button>{current.access.canManage&&current.contacts.length>1&&<button onClick={()=>begin("retire",c.id)}>Ngừng sử dụng</button>}</div>)}</>}
        {tab==="audit"&&(audit?.state==="loading"?<p>Đang tải Audit…</p>:audit?.state==="error"?<p role="alert">{audit.message}</p>:audit?.state==="ready"?audit.data.map(e=><div className={styles.card} key={e.id}><strong>{e.action}</strong><small>{e.occurredAt} · {e.actorLabel}</small><p>{e.reason}</p></div>):<p>Không có Audit.</p>)}
      </div>:<p>Chọn Parent để xem chi tiết.</p>}
    </BoDataGridSidePeek>}
  </main>;
}
