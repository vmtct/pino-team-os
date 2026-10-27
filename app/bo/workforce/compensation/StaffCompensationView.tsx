"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { boApi } from "@/lib/bo-api";
import type { BoStaffCompensationEntry, BoStaffRecord } from "@/lib/bo-model";
import styles from "../../bo.module.css";

type PrivateState =
  | { status:"idle"|"loading"|"error" }
  | { status:"ready"; rows:BoStaffCompensationEntry[] };

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

/** PAP-996: BO may reveal authorized compensation history, never author salary rates. */
export function StaffCompensationView(){
  const [staff,setStaff]=useState<BoStaffRecord[]>([]);
  const [staffSearch,setStaffSearch]=useState("");
  const [staffId,setStaffId]=useState("");
  const [centerId,setCenterId]=useState("");
  const [privateState,setPrivateState]=useState<PrivateState>({status:"idle"});
  const [selectedRate,setSelectedRate]=useState<BoStaffCompensationEntry|null>(null);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState<"ALL"|"CURRENT"|"HISTORICAL"|"SCHEDULED">("ALL");
  const [dateFilter,setDateFilter]=useState("");
  const fence=useRef(0);

  function hide(){
    fence.current+=1;
    setPrivateState({status:"idle"});
    setSelectedRate(null);
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

  return <main className={styles.panel} data-testid="staff-compensation-private">
    <div className={styles.panelHeading}>
      <div><h1>Lịch sử lương</h1>
        <p>Workforce · Dữ liệu nhạy cảm. BO chỉ xem sau khi Core xác thực quyền; thay đổi mức lương thuộc HO.</p></div>
      <span className={styles.readOnly}>private · read-only · VND</span>
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
          placeholder="Chỉ dùng khi xem theo Center" autoComplete="off"/>
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
        caption="Lịch sử lương đã xác thực" onRowOpen={setSelectedRate}
        emptyTitle="Chưa có mốc lương" emptyMessage="Chưa có dữ liệu lịch sử lương được phép xem."/>
    </>:null}
    {selectedRate&&privateState.status==="ready"?<BoDataGridSidePeek
      title={"Mốc lương "+selectedRate.effectiveFrom}
      eyebrow={selectedName+" · Private compensation"} onClose={()=>setSelectedRate(null)}>
      <p className={styles.staffWarning}>Chỉ xem · Quản lý mức lương và ngày hiệu lực thuộc HO.</p>
      <dl>
        <dt>Hiệu lực từ</dt><dd>{selectedRate.effectiveFrom}</dd>
        <dt>Đến trước</dt><dd>{selectedRate.periodUntilExclusive??"—"}</dd>
        <dt>Trạng thái</dt><dd>{selectedRate.state}</dd>
        <dt>Mức lương</dt><dd>{currency.format(selectedRate.amountMinor)} ₫</dd>
        <dt>Ghi chú</dt><dd>{selectedRate.note??"—"}</dd>
        <dt>Phiên bản</dt><dd>{selectedRate.version}</dd>
      </dl>
    </BoDataGridSidePeek>:null}
  </main>;
}
