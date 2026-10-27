"use client";

import { useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoStaffCompensationEntry } from "@/lib/bo-model";

/** PAP-876: sensitive compensation is loaded only on explicit reveal in Staff Full Detail.
 *  Staff directory / drawer payloads must never carry private salary details.
 */
export function BoStaffIncomeReadTab({staffMemberId}:{staffMemberId:string}){
  const [state,setState]=useState<"hidden"|"loading"|"ready"|"denied">("hidden");
  const [rows,setRows]=useState<BoStaffCompensationEntry[]>([]);
  const generation=useRef(0);

  function conceal(){
    generation.current+=1;
    setRows([]);
    setState("hidden");
  }
  useEffect(()=>{
    const onVisibility=()=>{if(document.hidden)conceal();};
    const onPageHide=()=>conceal();
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("pagehide",onPageHide);
    return()=>{
      generation.current+=1;
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("pagehide",onPageHide);
    };
  },[staffMemberId]);
  async function reveal(){
    const run=++generation.current;
    setRows([]);
    setState("loading");
    try{
      const data=await boApi.staffCompensation(staffMemberId);
      if(run!==generation.current)return;
      if(!Array.isArray(data)||data.some(row=>row.staffMemberId!==staffMemberId))throw Error("Compensation identity mismatch");
      setRows(data);
      setState("ready");
    }catch{
      if(run!==generation.current)return;
      setRows([]);
      setState("denied");
    }
  }
  const money=new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0});
  return <section className="property-section" aria-label="Thu nhập riêng tư">
    <h3>Thu nhập</h3>
    <p>Thông tin lương riêng tư, chỉ hiện khi có quyền. HO quản lý mức lương; BO chỉ xem.</p>
    {state==="hidden"||state==="denied"?<>
      {state==="denied"?<p role="alert">Không có quyền xem thu nhập hoặc dữ liệu không khả dụng.</p>:null}
      <button type="button" className="secondary-btn" onClick={()=>void reveal()}>Hiện lịch sử lương</button>
    </>:null}
    {state==="loading"?<p role="status">Đang xác thực quyền và tải lịch sử lương…</p>:null}
    {state==="ready"?<>
      <button type="button" className="secondary-btn" onClick={conceal}>Ẩn thông tin lương</button>
      {rows.length===0?<p role="status">Chưa có lịch sử mức lương được phép xem.</p>:
        rows.map(row=><div className="property-section" key={row.id}>
          <h4>Hiệu lực từ {row.effectiveFrom}</h4>
          <div className="property-row"><div className="property-label">Trạng thái</div><div className="property-control readonly">{row.state}</div></div>
          <div className="property-row"><div className="property-label">Đến trước</div><div className="property-control readonly">{row.periodUntilExclusive??"—"}</div></div>
          <div className="property-row"><div className="property-label">Mức lương</div><div className="property-control readonly">{money.format(row.amountMinor)} ₫</div></div>
          <div className="property-row"><div className="property-label">Ghi chú</div><div className="property-control readonly">{row.note??"—"}</div></div>
        </div>)
      }
    </>:null}
  </section>;
}
