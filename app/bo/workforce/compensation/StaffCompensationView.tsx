"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { boApi } from "@/lib/bo-api";
import type { BoStaffCompensationEntry, BoStaffRecord } from "@/lib/bo-model";
import styles from "../../bo.module.css";

type PrivateState =
  | { status:"idle"|"loading"|"error" }
  | { status:"ready"; rows:BoStaffCompensationEntry[] };
type Editor = { mode:"create"|"correct"; id:string|null; effectiveFrom:string;
  amountMinor:string; note:string; expectedVersion:number; original:string };

const currency=new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0});
const columns:BoDataGridColumn<BoStaffCompensationEntry>[]=[
  {key:"effective",header:"Hiệu lực từ",sortable:true,render:row=><strong>{row.effectiveFrom}</strong>},
  {key:"period",header:"Đến trước",render:row=><span>{row.periodUntilExclusive??"—"}</span>},
  {key:"state",header:"Trạng thái",render:row=><BoDataGridStatus value={row.state}
    tone={row.state==="CURRENT"?"success":row.state==="SCHEDULED"?"info":"neutral"}/>},
  {key:"amount",header:"Lương (VND)",render:row=><strong>{currency.format(row.amountMinor)} ₫</strong>},
  {key:"note",header:"Lý do",render:row=><span>{row.note??"—"}</span>},
  {key:"updated",header:"Cập nhật",render:row=><span>{row.updatedAt.slice(0,10)}</span>},
];

export function StaffCompensationView(){
  const [staff,setStaff]=useState<BoStaffRecord[]>([]);
  const [staffSearch,setStaffSearch]=useState("");
  const [staffId,setStaffId]=useState("");
  const [centerId,setCenterId]=useState("");
  const [privateState,setPrivateState]=useState<PrivateState>({status:"idle"});
  const [editor,setEditor]=useState<Editor|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState<"ALL"|"CURRENT"|"HISTORICAL"|"SCHEDULED">("ALL");
  const [dateFilter,setDateFilter]=useState("");
  const fence=useRef(0);

  function hide(){
    fence.current+=1;
    setPrivateState({status:"idle"});
    setEditor(null);
    setError("");
  }
  useEffect(()=>{
    let active=true;
    void boApi.staffRecords().then(rows=>{if(active)setStaff(rows);})
      .catch(()=>{if(active)setError("Không thể tải danh sách nhân viên.");});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    const onVisibility=()=>{if(document.hidden)hide();};
    const onPageHide=()=>hide();
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("pagehide",onPageHide);
    return()=>{document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("pagehide",onPageHide);fence.current+=1;};
  },[]);

  const visibleStaff=useMemo(()=>staff.filter(row=>
    (row.displayLabel+" "+row.id).toLocaleLowerCase("vi").includes(staffSearch.toLocaleLowerCase("vi"))
  ),[staff,staffSearch]);
  const selected=staff.find(row=>row.id===staffId);
  const rows=privateState.status==="ready"?privateState.rows:[];
  const filtered=rows.filter(row=>(filter==="ALL"||row.state===filter)
    && (!dateFilter||row.effectiveFrom>=dateFilter));
  const selectedName=selected?.displayLabel??"Nhân viên";

  async function reveal(){
    if(!staffId)return;
    const generation=++fence.current;
    setPrivateState({status:"loading"});setError("");
    try{
      const data=await boApi.staffCompensation(staffId,centerId||undefined);
      if(generation===fence.current)setPrivateState({status:"ready",rows:data});
    }catch{
      if(generation===fence.current){setPrivateState({status:"error"});
        setError("Không có quyền xem lịch sử lương hoặc dữ liệu tạm thời không khả dụng.");}
    }
  }
  function openCreate(){
    if(privateState.status!=="ready")return;
    const initial={mode:"create" as const,id:null,effectiveFrom:"",
      amountMinor:"",note:"",expectedVersion:0};
    setEditor({...initial,original:JSON.stringify(initial)});
  }
  function openCorrect(row:BoStaffCompensationEntry){
    const initial={mode:"correct" as const,id:row.id,effectiveFrom:row.effectiveFrom,
      amountMinor:String(row.amountMinor),note:row.note??"",expectedVersion:row.version};
    setEditor({...initial,original:JSON.stringify(initial)});
  }
  function closeEditor(){
    if(!editor)return;
    const {original,...current}=editor;
    if(JSON.stringify(current)!==original && !window.confirm("Bỏ thay đổi chưa lưu?"))return;
    setEditor(null);
  }
  async function save(){
    if(!editor||!staffId||privateState.status!=="ready"||busy)return;
    const amountMinor=Number(editor.amountMinor);
    if(!Number.isSafeInteger(amountMinor)||amountMinor<=0||amountMinor>1_000_000_000_000){
      setError("Mức lương phải là số VND nguyên dương.");return;
    }
    if(editor.mode==="create"&&!/^\d{4}-\d{2}-\d{2}$/.test(editor.effectiveFrom)){
      setError("Chọn ngày hiệu lực hợp lệ.");return;
    }
    setBusy(true);setError("");
    const generation=fence.current;
    try{
      if(editor.mode==="create"){
        await boApi.createStaffCompensation(staffId,{effectiveFrom:editor.effectiveFrom,
          amountMinor,note:editor.note||null,...(centerId?{centerId}:{})});
      }else if(editor.id){
        await boApi.correctStaffCompensation(staffId,editor.id,{amountMinor,
          expectedVersion:editor.expectedVersion,note:editor.note||null,...(centerId?{centerId}:{})});
      }
      if(generation!==fence.current)return;
      const refreshed=await boApi.staffCompensation(staffId,centerId||undefined);
      if(generation===fence.current){setPrivateState({status:"ready",rows:refreshed});setEditor(null);}
    }catch{
      if(generation===fence.current){
        hide();
        setError("Không thể lưu. Kiểm tra quyền, dữ liệu trùng hoặc phiên bản đã thay đổi rồi xác thực lại.");
      }
    }finally{setBusy(false);}
  }

  return <main className={styles.panel} data-testid="staff-compensation-private">
    <div className={styles.panelHeading}>
      <div><h1>Lịch sử lương</h1>
        <p>Workforce · Dữ liệu nhạy cảm. Chỉ tải sau khi bấm Hiện và được Core xác thực quyền.</p></div>
      <span className={styles.readOnly}>private · VND</span>
    </div>
    <div className={styles.formGrid}>
      <label className={styles.field}>Tìm nhân viên
        <input value={staffSearch} onChange={event=>setStaffSearch(event.target.value)}
          placeholder="Tên hoặc Staff ID" autoComplete="off"/>
      </label>
      <label className={styles.field}>Nhân viên
        <select value={staffId} onChange={event=>{hide();setStaffId(event.target.value);}}>
          <option value="">Chọn nhân viên</option>
          {visibleStaff.map(row=><option key={row.id} value={row.id}>{row.displayLabel}</option>)}
        </select>
      </label>
      <label className={styles.field}>Center ID (tùy chọn)
        <input value={centerId} onChange={event=>{hide();setCenterId(event.target.value);}}
          placeholder="Chỉ dùng khi thao tác theo Center" autoComplete="off"/>
      </label>
    </div>
    {staffId?<div className={styles.staffActions}>
      {privateState.status==="idle"||privateState.status==="error"?
        <button className={styles.primaryButton} type="button" onClick={()=>void reveal()}>
          Hiện lịch sử lương · {selectedName}</button>:null}
      {privateState.status==="loading"?<p>Đang xác thực quyền truy cập…</p>:null}
      {privateState.status==="ready"?<button className={styles.secondaryButton}
        type="button" onClick={hide}>Ẩn toàn bộ dữ liệu lương</button>:null}
    </div>:<p>Chọn nhân viên để yêu cầu xem thông tin lương riêng tư.</p>}
    {error?<p role="alert" className={styles.staffWarning}>{error}</p>:null}
    {privateState.status==="ready"?<>
      <div className={styles.formGrid}>
        <label className={styles.field}>Trạng thái
          <select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}>
            <option value="ALL">Tất cả</option><option value="CURRENT">Hiện tại</option>
            <option value="HISTORICAL">Lịch sử</option><option value="SCHEDULED">Sắp tới</option>
          </select>
        </label>
        <label className={styles.field}>Hiệu lực từ ngày
          <input type="date" value={dateFilter} onChange={event=>setDateFilter(event.target.value)}/>
        </label>
      </div>
      <BoDataGrid rows={filtered} columns={columns} rowKey={row=>row.id}
        caption="Lịch sử lương đã xác thực" onRowOpen={openCorrect}
        emptyTitle="Chưa có mốc lương" emptyMessage="Có thể tạo mốc lương đầu tiên."
        toolbarActions={<button className={styles.primaryButton} type="button"
          onClick={openCreate}>Thêm mốc lương</button>}/>
    </>:null}
    {editor&&privateState.status==="ready"?<BoDataGridSidePeek
      title={editor.mode==="create"?"Thêm mốc lương":"Hiệu chỉnh mốc lương"}
      eyebrow={selectedName+" · Private compensation"} onClose={closeEditor}>
      <p className={styles.staffWarning}>Thay đổi thông tin lương nhạy cảm. Core sẽ ghi Audit và kiểm tra phiên bản.</p>
      <div className={styles.formGrid}>
        <label className={styles.field}>Ngày hiệu lực
          <input type="date" value={editor.effectiveFrom} disabled={editor.mode==="correct"}
            onChange={event=>setEditor({...editor,effectiveFrom:event.target.value})}/>
        </label>
        <label className={styles.field}>Mức lương (VND)
          <input type="number" min="1" step="1" value={editor.amountMinor}
            onChange={event=>setEditor({...editor,amountMinor:event.target.value})}/>
        </label>
        <label className={styles.field}>Ghi chú / lý do
          <textarea value={editor.note} maxLength={500}
            onChange={event=>setEditor({...editor,note:event.target.value})}/>
        </label>
      </div>
      <div className={styles.staffActions}>
        <button type="button" className={styles.primaryButton} disabled={busy}
          onClick={()=>void save()}>{busy?"Đang lưu…":"Lưu thay đổi"}</button>
        <button type="button" className={styles.secondaryButton} onClick={closeEditor}>Hủy</button>
      </div>
    </BoDataGridSidePeek>:null}
  </main>;
}
