"use client";
// PAP-2358 · WFM-STAFF. Explicit read-only Person choice; never infer a match.
import {useEffect,useRef,useState} from "react";
import type {StaffPersonOption,createStaffPersonReader} from "./staff-person-reader";
type Reader=ReturnType<typeof createStaffPersonReader>;
export function StaffPersonPicker({reader,selected,onSelect,disabled,onBusy}:{reader:Reader;selected:StaffPersonOption|null;onSelect:(value:StaffPersonOption|null)=>void;disabled:boolean;onBusy:(value:boolean)=>void}){
  const [query,setQuery]=useState(""),[options,setOptions]=useState<StaffPersonOption[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [searched,setSearched]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  function reset(value:string){setQuery(value);setOptions([]);setCursor(null);setSearched(false);setError("");}
  async function run(more=false){
    if(disabled||active.current||!query.trim())return;
    const controller=new AbortController();active.current=controller;setBusy(true);onBusy(true);setError("");
    try{
      const result=await reader.search(query,more?cursor:null,controller.signal);
      if(!controller.signal.aborted){setOptions(prior=>more?[...prior,...result.options]:result.options);setCursor(result.nextAfter);setSearched(true);}
    }catch{if(!controller.signal.aborted)setError("Không tải được Person. Hãy thử lại.");}
    finally{if(active.current===controller){active.current=null;if(!controller.signal.aborted){setBusy(false);onBusy(false);}}}
  }
  async function choose(id:string){
    if(disabled||active.current)return;
    const controller=new AbortController();active.current=controller;setBusy(true);onBusy(true);setError("");
    try{const value=await reader.select(id,controller.signal);if(!controller.signal.aborted)onSelect(value);}
    catch{if(!controller.signal.aborted)setError("Person không còn khả dụng. Hãy tìm lại.");}
    finally{if(active.current===controller){active.current=null;if(!controller.signal.aborted){setBusy(false);onBusy(false);}}}
  }
  return <div>
    {selected?<><p>Person đã chọn: {selected.label} · {selected.id}</p><button className="secondary-btn" type="button" disabled={disabled||busy} onClick={()=>{onSelect(null);reset("");}}>Bỏ liên kết</button></>:<>
      <p>Không chọn Person nếu tạo hồ sơ mới. Chỉ liên kết khi đã xác định đúng danh tính.</p>
      <input className="property-control os-create-select" id="staff-create-person-search" aria-label="Tìm Person hiện có" value={query} disabled={disabled||busy} maxLength={120} onChange={e=>reset(e.target.value)}/>
      <button className="secondary-btn" type="button" disabled={disabled||busy||!query.trim()} onClick={()=>void run()}>Tìm Person</button>
      {options.map(option=><div key={option.id}><button className="secondary-btn" type="button" disabled={disabled||busy} onClick={()=>void choose(option.id)}>Chọn {option.label} · {option.id}</button></div>)}
      {searched&&options.length===0?<p role="status">Không tìm thấy Person phù hợp.</p>:null}
      {cursor?<button className="secondary-btn" type="button" disabled={disabled||busy} onClick={()=>void run(true)}>Xem thêm</button>:null}
    </>}
    {busy?<p role="status">Đang tải Person…</p>:null}{error?<p role="alert">{error}</p>:null}
  </div>;
}
