"use client";
import {useEffect,useRef,useState} from 'react';
import {DrawerFrame} from '@/app/components/workspace-renderer/DrawerFrame';
import {loadWeek,weekRequest} from '@/lib/ho-termweek-client';
import {parseWeekCommand,type HoWeekDetail,type WeekAction} from '@/lib/ho-termweek-contract';
import {object} from '@/lib/ho-global-terms-contract';
import {BoApiError} from '@/lib/bo-api-error';
type Parent={id:string;name:string;startDate:string;endDate:string};
/** PAP-1373: domain form in the shared DS DrawerFrame, opened by TDD registered actions. */
export function HoGlobalTermWeekEditor({action,id,fetcher,onClose,onSaved}:{action:WeekAction;id?:string;fetcher:typeof fetch;onClose:()=>void;onSaved:()=>void}){
 const [week,setWeek]=useState<HoWeekDetail|null>(null),[parents,setParents]=useState<Parent[]>([]),[termId,setTermId]=useState('');
 const [code,setCode]=useState(''),[ordinal,setOrdinal]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[rhythm,setRhythm]=useState(''),[reason,setReason]=useState(''),[locked,setLocked]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0),[stale,setStale]=useState(false);
 const replay=useRef<{body:string;key:string}|null>(null),lifetime=useRef<AbortController|null>(null);
 useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();
  const load=async()=>{if(action==='create'){const d=object(await weekRequest('?catalog=1',{method:'GET',signal:controller.signal},fetcher));if(!Array.isArray(d?.terms))throw Error('Không tải được Global Terms.');const catalog=d.terms as Parent[];setParents(catalog);const parent=new URLSearchParams(location.search).get('termId');if(parent&&catalog.some(t=>t.id===parent))setTermId(parent);}
   else if(id){const w=await loadWeek(id,fetcher,controller.signal);setWeek(w);setTermId(w.termId);setParents([w.parent]);setCode(w.code);setOrdinal(String(w.ordinal));setStart(w.startDate);setEnd(w.endDate);setRhythm(w.rhythmKey);setLocked(w.global_week_registration_locked);}
   if(!controller.signal.aborted){setLoading(false);setStale(false);}};
  void load().catch(e=>{if(!controller.signal.aborted){setLoading(false);setError(e instanceof Error?e.message:'Không thể tải dữ liệu.');setStale(true);}});return()=>controller.abort();
 },[action,id,fetcher,reload]);
 const parent=parents.find(t=>t.id===termId),close=()=>{if(!busy)onClose();};
 const command=action==='delete'?{expectedUpdatedAt:week?.updatedAt,reason:reason.trim()}:action==='lock'?{termWeekId:id,locked,expectedVersion:week?.lockVersion,reason:reason.trim()}:{code:code.trim(),ordinal:Number(ordinal),startDate:start,endDate:end,rhythmKey:rhythm.trim(),reason:reason.trim(),...(action==='create'?{termId}:{expectedUpdatedAt:week?.updatedAt})};
 const valid=action==='lock'?!!week&&!!reason.trim()&&locked!==week.global_week_registration_locked:!!parseWeekCommand(command,action);
 async function save(){if(busy||loading||stale||!valid||action==='delete'&&!week?.deletionEligible)return;
  const body=JSON.stringify(command);if(replay.current?.body!==body)replay.current={body,key:crypto.randomUUID()};setBusy(true);setError('');
  try{const init={method:'POST',headers:{'content-type':'application/json','idempotency-key':replay.current!.key},body,signal:lifetime.current?.signal};
   if(action==='lock'){const response=await fetcher('/api/ho/workforce/global-week-registration',init);const d=object(object(await response.json().catch(()=>null))?.data);if(!response.ok)throw new BoApiError(response.status,response.status===409?'Trạng thái khóa đã thay đổi. Tải lại trước khi lưu.':'Không thể xác minh thay đổi Global Lock.',null);if(!d||d.termWeekId!==id||d.locked!==locked||d.version!==week!.lockVersion+1)throw Error('Core chưa xác nhận Global Lock.');}
   else{const saved=object(await weekRequest(action==='create'?'':'/'+id+'/'+action,init,fetcher));if(action==='delete'){if(saved?.termWeekId!==id||saved?.deleted!==true)throw Error('Core chưa xác nhận xóa.');}else if(!saved||typeof saved.id!=='string'||action==='update'&&saved.id!==id)throw Error('Core chưa xác nhận lưu.');}
   onSaved();
  }catch(e){if(lifetime.current?.signal.aborted)return;setError(e instanceof Error?e.message:'Chưa xác minh được kết quả.');setStale(!(action==='create'&&e instanceof BoApiError&&e.status===409));}finally{setBusy(false);}
 }
 return <DrawerFrame title={action==='create'?'Tạo Global TermWeek':action==='update'?'Chỉnh sửa Global TermWeek':action==='delete'?'Xác nhận xóa Global TermWeek':'Global Lock ON/OFF'} path="Operating Cycle · Global TermWeeks" onClose={close}
  footer={<><button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button><button type="button" className="primary-btn" disabled={busy||loading||stale||!valid||action==='delete'&&!week?.deletionEligible} onClick={()=>void save()}>{busy?'Đang xác minh…':action==='create'?'Tạo':action==='delete'?'Xác nhận xóa':'Lưu'}</button></>}>
  {loading?<p role="status">Đang đọc Core…</p>:<section className="property-section" aria-labelledby="week-editor-heading">
   <h3 id="week-editor-heading">{action==='delete'?'Xác nhận xóa tuần':action==='lock'?'Khóa đăng ký toàn hệ thống':'Thông tin tuần'}</h3>
   {action==='delete'?<><p>{week?.name}</p><p className="settings-hint">Chỉ xóa tuần không có dữ liệu tham chiếu. Không xóa dây chuyền.</p>{week&&!week.deletionEligible&&<p role="status" className="edit-error">Không thể xóa: {week.referenceCount} tham chiếu vận hành hoặc lịch sử.</p>}</>:action==='lock'?<>
    <p>{week?.name}</p><p className="settings-hint">Bật khóa để chặn đăng ký toàn bộ Center cho tuần này. Tắt chỉ gỡ rào cản toàn hệ thống; giữ nguyên FORCE_LOCKED, trạng thái đăng ký và kế hoạch của từng Center.</p>
    <div className="property-row"><label htmlFor="week-global-lock">Khóa đăng ký toàn hệ thống</label><input id="week-global-lock" type="checkbox" checked={locked} disabled={busy||stale} onChange={e=>setLocked(e.target.checked)}/></div>
    <p role="status">{week?.global_week_registration_locked?'Global Lock đang ON':'Global Lock đang OFF'}</p>
   </>:<div className="drawer-fields">
    <div className="property-row"><label htmlFor="week-term">Global Term *</label><select className="edit-input" id="week-term" required value={termId} disabled={busy||stale||action!=='create'} onChange={e=>setTermId(e.target.value)}><option value="">Chọn Global Term</option>{parents.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
    {!parents.length&&<p role="status">Chưa có Global Term. Tạo học kỳ trước khi tạo tuần.</p>}
    <div className="property-row"><label htmlFor="week-code">Mã tuần *</label><input className="edit-input" id="week-code" required maxLength={96} value={code} disabled={busy||stale} onChange={e=>setCode(e.target.value)}/></div>
    <div className="property-row"><label htmlFor="week-ordinal">Thứ tự *</label><input className="edit-input" id="week-ordinal" required type="number" min={1} step={1} value={ordinal} disabled={busy||stale} onChange={e=>setOrdinal(e.target.value)}/></div>
    <div className="property-row"><label htmlFor="week-start">Bắt đầu *</label><input className="edit-input" id="week-start" required type="date" min={parent?.startDate} max={parent?.endDate} value={start} disabled={busy||stale} onChange={e=>setStart(e.target.value)}/></div>
    <div className="property-row"><label htmlFor="week-end">Kết thúc *</label><input className="edit-input" id="week-end" required type="date" min={start||parent?.startDate} max={parent?.endDate} value={end} disabled={busy||stale} onChange={e=>setEnd(e.target.value)}/></div>
    <div className="property-row"><label htmlFor="week-rhythm">Nhịp *</label><input className="edit-input" id="week-rhythm" required maxLength={96} value={rhythm} disabled={busy||stale} onChange={e=>setRhythm(e.target.value)}/></div>
    <p className="settings-hint">Tuần thuộc GLOBAL. ID và học kỳ không thể thay đổi. Nhập khoảng ngày và nhịp rõ ràng; Core kiểm tra trùng lặp, ngày và tham chiếu.</p>
   </div>}
   <div className="property-row"><label htmlFor="week-reason">Lý do *</label><textarea className="edit-input" id="week-reason" required maxLength={500} value={reason} disabled={busy||stale} onChange={e=>setReason(e.target.value)}/></div>
  </section>}
  {error&&<p role="alert" className="edit-error">{error}</p>}
  {(error||stale)&&<button type="button" className="secondary-btn" disabled={busy} onClick={()=>{setLoading(true);setError('');setReload(n=>n+1);}}>Tải lại từ Core</button>}
 </DrawerFrame>;
}
