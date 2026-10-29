"use client";

import { useCallback, useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoParentSearchResult } from "@/lib/bo-model";
import { walkinPassBoApi, type WalkinPass, type WalkinPath } from "@/lib/open-studio-walkin-bo-api";
import styles from "./walkin-pass.module.css";
import { assignmentReady, WALKIN_PATHS } from "@/lib/open-studio-walkin-ui-contract";

const STATUS: Record<WalkinPass["status"], string> = {
 AVAILABLE:"Chưa cấp", ASSIGNED:"Đã cấp", CONSUMED:"Đã sử dụng", REVOKED:"Đã thu hồi",
};
type Mode = "assign" | "quick" | "detail" | null;

/** Real BO staging adapter. No fixture, no membership/listing Pass writes. */
export function WalkinPassPanel({centerId}:{centerId:string}) {
 const [rows,setRows]=useState<WalkinPass[]>([]);
 const [state,setState]=useState<"loading"|"ready"|"error">("loading");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mode,setMode]=useState<Mode>(null);
 const [selected,setSelected]=useState<WalkinPass|null>(null);
 const [busy,setBusy]=useState(false);
 const [parentQuery,setParentQuery]=useState("");
 const [parents,setParents]=useState<BoParentSearchResult[]>([]);
 const [parentId,setParentId]=useState("");
 const [path,setPath]=useState<WalkinPath| "">("");
 const [searching,setSearching]=useState(false);

 const refresh=useCallback(async()=>{
  if(!centerId){setRows([]);setState("ready");return;}
  setState("loading");setError("");
  try{setRows(await walkinPassBoApi.inventory(centerId));setState("ready");}
  catch(e){setState("error");setError(e instanceof Error?e.message:"Không thể tải Pass");}
 },[centerId]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void refresh()});return()=>{active=false}},[refresh]);
 useEffect(()=>{
  if(!mode)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)setMode(null)};
  document.addEventListener("keydown",onKey);
  return()=>document.removeEventListener("keydown",onKey);
 },[mode,busy]);

 const openAssign=()=>{
  setSelected(null);setParentId("");setPath("");setParentQuery("");setParents([]);setError("");setMode("assign");
 };
 async function searchParent(){
  setSearching(true);setError("");
  try{setParents((await boApi.parents(parentQuery.trim(),50)).filter(row=>row.parent.status==="ACTIVE"));}
  catch(e){setError(e instanceof Error?e.message:"Không tìm thấy Parent");}
  finally{setSearching(false);}
 }
 async function assign(){
  if(!assignmentReady(parentId,path,centerId,busy))return;
  setBusy(true);setError("");
  try{
   const pass=await walkinPassBoApi.assign(parentId,centerId,path as WalkinPath);
   setNotice(`Đã cấp Pass ${pass.code} · ${pass.path_code}`);
   await refresh();
   setSelected(pass);setMode("quick");
  }catch(e){setError(e instanceof Error?e.message:"Không thể cấp Pass");}
  finally{setBusy(false);}
 }
 async function revoke(){
  if(!selected||!["AVAILABLE","ASSIGNED"].includes(selected.status)||busy)return;
  if(!confirm("Thu hồi Pass này? Hành động sẽ được ghi lịch sử."))return;
  setBusy(true);setError("");
  try{
   await walkinPassBoApi.revoke(selected.id);
   setNotice("Pass đã được thu hồi.");setMode(null);setSelected(null);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Không thể thu hồi");}
  finally{setBusy(false);}
 }
 const copy=async()=>{
  if(!selected)return;
  try{await navigator.clipboard.writeText(selected.code);setNotice("Đã sao chép mã e-pass");}
  catch{setError("Không thể sao chép. Hãy chọn mã Pass để sao chép thủ công.");}
 };
 const view=(item:WalkinPass)=>{setError("");setSelected(item);setMode("quick");};
 return <section className={styles.section} aria-labelledby="walkin-heading">
  <div className={styles.head}>
   <div><h2 id="walkin-heading">Trạm Nghệ Thuật · Pass một lượt</h2><p>Kho Pass và cấp Parent theo Path — tách biệt Listing/Booking.</p></div>
   <button type="button" className={styles.primary} onClick={openAssign} disabled={!centerId}>＋ Cấp Pass</button>
  </div>
  {!centerId?<p className={styles.info}>Chọn Center trước khi quản lý Pass.</p>:null}
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  {state==="loading"?<p className={styles.info}>Đang tải kho Pass…</p>:null}
  {state==="error"?<p role="alert" className={styles.error}>{error}</p>:null}
  {state==="ready"&&centerId?<div className={styles.tableWrap}>
   <table className={styles.table}><thead><tr><th>Mã Pass</th><th>Trạng thái</th><th>Path</th><th>Parent</th><th></th></tr></thead>
   <tbody>{rows.length===0?<tr><td colSpan={5}>Chưa có Pass tại Center này hoặc chưa được cấp quyền đọc.</td></tr>:rows.map(item=>
    <tr key={item.id}><th scope="row">{item.code}</th><td>{STATUS[item.status]}</td><td>{item.path_code??"—"}</td><td>{item.parent_user_id??"—"}</td>
     <td><button className={styles.link} onClick={()=>view(item)} type="button" aria-label={`Xem Pass ${item.code}`}>Xem</button></td></tr>)}</tbody></table>
  </div>:null}
  {mode?<div className={styles.scrim} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setMode(null)}}>
   <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={mode==="assign"?"Cấp Pass":mode==="detail"?"Thông tin Pass":"Xem nhanh Pass"}>
    <div className={styles.drawerHeader}>
     <h3>{mode==="assign"?"Cấp Pass cho Parent":mode==="detail"?"Thông tin Pass":"Xem nhanh Pass"}</h3>
     <button type="button" onClick={()=>setMode(null)} disabled={busy} aria-label="Đóng" className={styles.close}>×</button>
    </div>
    {mode==="assign"?<div className={styles.body}>
     <label className={styles.field}>Tìm Parent hiện hữu
      <span className={styles.searchRow}><input type="search" value={parentQuery} onChange={e=>setParentQuery(e.target.value)} placeholder="Tên / số điện thoại / email"/>
       <button type="button" onClick={()=>void searchParent()} disabled={searching}>{searching?"…":"Tìm"}</button></span>
     </label>
     <label className={styles.field}>Parent <strong>*</strong>
      <select aria-label="Chọn Parent" value={parentId} onChange={e=>setParentId(e.target.value)}>
       <option value="">Chọn Parent…</option>
       {parents.map(x=><option key={x.parent.id} value={x.parent.id}>{x.parent.displayName??"Chưa có tên"} · {x.contacts.find(c=>c.isPrimary)?.normalizedValue??x.parent.id}</option>)}
      </select>
     </label>
     <label className={styles.field}>Path của Pass <strong>*</strong>
      <select aria-label="Chọn Path" value={path} onChange={e=>setPath(e.target.value as WalkinPath|"")}>
       <option value="">Chọn Path…</option>{WALKIN_PATHS.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
     </label>
     <p className={styles.info}>Một Parent chỉ có một Pass chưa sử dụng. Chưa chọn Path sẽ không thể cấp.</p>
     <button className={styles.primary} type="button" disabled={!assignmentReady(parentId,path,centerId,busy)} onClick={()=>void assign()}>
      {busy?"Đang cấp…":"Xác nhận cấp Pass"}
     </button>
    </div>:null}
    {mode!=="assign"&&selected?<div className={styles.body}>
     <dl className={styles.fields}>
      <div><dt>Mã Pass</dt><dd>{selected.code}</dd></div>
      <div><dt>Trạng thái</dt><dd>{STATUS[selected.status]}</dd></div>
      <div><dt>Path</dt><dd>{selected.path_code??"Chưa chọn"}</dd></div>
      <div><dt>Parent ID</dt><dd>{selected.parent_user_id??"Chưa cấp"}</dd></div>
      <div><dt>Center</dt><dd>{selected.center_id??"Kho chung"}</dd></div>
     </dl>
     <div className={styles.actions}>
      <button className={styles.secondary} type="button" onClick={()=>void copy()}>Sao chép e-pass</button>
      {mode==="quick"?<button className={styles.secondary} onClick={()=>setMode("detail")} type="button">Chi tiết</button>:null}
      {["AVAILABLE","ASSIGNED"].includes(selected.status)?<button className={styles.danger} type="button" disabled={busy} onClick={()=>void revoke()}>Thu hồi</button>:null}
     </div>
     {mode==="detail"?<div className={styles.info}>Lịch sử thao tác: cần nối Core audit read-only trước khi nghiệm thu Full Detail.</div>:null}
    </div>:null}
    {error?<p className={styles.error} role="alert">{error}</p>:null}
   </aside>
  </div>:null}
 </section>;
}
