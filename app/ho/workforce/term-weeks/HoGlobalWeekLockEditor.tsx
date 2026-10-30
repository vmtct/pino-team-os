"use client";
import { useEffect, useState } from "react";

type WeekLock={termWeekId:string;locked:boolean;version:number};
type LoadState={kind:"loading"}|{kind:"error";message:string}|{kind:"ready";value:WeekLock};
const readState=(body:unknown,id:string):WeekLock=>{
  const data=(body as {data?:unknown}|null)?.data as Partial<WeekLock>|undefined;
  if(!data||data.termWeekId!==id||typeof data.locked!=="boolean"||
    !Number.isSafeInteger(data.version)||Number(data.version)<0)
    throw Error("Trạng thái khóa tuần từ Core không hợp lệ.");
  return {termWeekId:id,locked:data.locked,version:Number(data.version)};
};
/** PAP-1198: domain action inside an approved TDD business tab, never generic property edit. */
export function HoGlobalWeekLockEditor({termWeekId,authorized,onSaved}:{
  termWeekId:string;authorized:boolean;onSaved:()=>void;
}){
  const [load,setLoad]=useState<LoadState>({kind:"loading"});
  const [reason,setReason]=useState("");
  const [checked,setChecked]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!authorized)return;
    const controller=new AbortController();
    void fetch("/api/ho/workforce/global-week-registration?termWeekId="+encodeURIComponent(termWeekId),{
      cache:"no-store",signal:controller.signal,
    }).then(async response=>{
      if(!response.ok)throw Error(response.status===403?"Không được cấp quyền khóa tuần.":"Không tải được trạng thái khóa tuần.");
      return readState(await response.json(),termWeekId);
    }).then(value=>{
      if(!controller.signal.aborted){setLoad({kind:"ready",value});setChecked(value.locked);setReason("");setError("");}
    }).catch((cause:unknown)=>{
      if(!controller.signal.aborted)setLoad({kind:"error",message:cause instanceof Error?cause.message:"Không tải được trạng thái."});
    });
    return ()=>controller.abort();
  },[termWeekId,retry,authorized]);
  async function save(){
    if(!authorized||load.kind!=="ready"||saving||checked===load.value.locked||!reason.trim())return;
    setSaving(true);setError("");
    try{
      const response=await fetch("/api/ho/workforce/global-week-registration",{
        method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify({termWeekId,locked:checked,expectedVersion:load.value.version,reason:reason.trim()}),
      });
      if(!response.ok)throw Error(response.status===409?"Trạng thái tuần đã thay đổi. Tải lại trước khi lưu.":response.status===403?
        "Không có quyền thay đổi khóa tuần.":"Core từ chối lưu trạng thái khóa tuần.");
      const confirmed=readState(await response.json(),termWeekId);
      if(confirmed.locked!==checked||confirmed.version!==load.value.version+1)
        throw Error("Core chưa xác nhận thay đổi.");
      setLoad({kind:"ready",value:confirmed});setReason("");onSaved();
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Lưu thất bại.");
    }finally{setSaving(false);}
  }
  return <section aria-labelledby="ho-global-week-lock-title" data-ho-week-lock>
    <h3 id="ho-global-week-lock-title">Khóa đăng ký tuần cho toàn bộ chi nhánh</h3>
    <p>Khi bật, BO sẽ thông báo và tắt khu xếp ca; Staff không thể đăng ký tuần này tại bất kỳ Center nào.
      Khi tắt, trạng thái khóa/mở thủ công riêng của từng Center được giữ nguyên.</p>
    {!authorized ? <p role="alert">Không có quyền quản lý khóa tuần toàn chi nhánh.</p>
      : load.kind==="loading" ? <p role="status">Đang đọc Core…</p>
      : load.kind==="error" ? <div role="alert">{load.message} <button type="button" onClick={()=>setRetry(n=>n+1)}>Tải lại</button></div>
      : <div>
        <label><input type="checkbox" checked={checked} disabled={!authorized||saving}
          onChange={event=>setChecked(event.target.checked)}/> Khóa đăng ký toàn bộ chi nhánh</label>
        <p role="status">{load.value.locked?"Đang khóa toàn hệ thống":"Đang mở theo trạng thái từng chi nhánh"}</p>
        <label>Lý do thay đổi
          <textarea className="edit-input" value={reason} maxLength={500} disabled={saving||!authorized}
            onChange={event=>setReason(event.target.value)} />
        </label>
        {error?<p role="alert">{error}</p>:null}
        <div>
          <button className="primary-btn" type="button" disabled={!authorized||saving||checked===load.value.locked||!reason.trim()}
            onClick={()=>void save()}>{saving?"Đang lưu…":"Lưu"}</button>
          <button className="secondary-btn" type="button" disabled={saving} onClick={()=>{setChecked(load.value.locked);setReason("");setError("");}}>Hủy</button>
          <button className="secondary-btn" type="button" disabled={saving} onClick={()=>setRetry(n=>n+1)}>Tải lại</button>
        </div>
      </div>}
  </section>;
}
