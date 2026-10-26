"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import { boApi, type BoAccessAuditPage } from "@/lib/bo-api";
import type { BoAccessAuditEvent } from "@/lib/bo-access-model";

const sizes = [10,25,50,100] as const;
const blank:BoAccessAuditPage={events:[],page:{limit:25,offset:0,total:0,page:1,pageCount:0,hasPrevious:false,hasNext:false}};
type VisibleEvent = Omit<BoAccessAuditEvent, "payload">;
function tone(value:string):"success"|"warning"|"danger"|"neutral" {
 return value==="succeeded"?"success":value==="denied"?"warning":value==="failed"?"danger":"neutral";
}
export function HoAccessAudit() {
 const [result,setResult]=useState<BoAccessAuditPage>(blank);
 const [page,setPage]=useState(1);
 const [size,setSize]=useState(25);
 const [query,setQuery]=useState("");
 const [outcome,setOutcome]=useState("");
 const [reload,setReload]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);

 useEffect(()=>{
  let alive=true;
  void boApi.accessAuditPage({limit:size,offset:(page-1)*size,
   ...(query.trim()?{query:query.trim().slice(0,120)}:{}),
   ...(outcome?{outcome}:{})})
   .then(data=>{if(!alive)return;const last=Math.max(1,data.page.pageCount);
    if(page>last){setPage(last);return;}setResult(data);})
   .catch(e=>{if(alive){setResult(blank);setError(e instanceof Error?e.message:"Không tải được Access Audit.");}})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[page,size,query,outcome,reload]);

 const selected=result.events.find(e=>e.id===selectedId) ?? null;
 const cols=useMemo<BoDataGridColumn<VisibleEvent>[]>(()=>[
  {key:"action",header:"Event",minWidth:230,render:e=><span><strong>{e.action}</strong><BoDataGridCanonicalId value={e.id} /></span>},
  {key:"time",header:"Time / Result",minWidth:200,render:e=><span><time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleString("vi-VN")}</time><br/><BoDataGridStatus value={e.outcome} tone={tone(e.outcome)}/></span>},
  {key:"actor",header:"Actor",minWidth:205,render:e=><span>{e.actorType}<br/><code>{e.actorId??"system"}</code></span>},
  {key:"subject",header:"Target",minWidth:205,render:e=><span>{e.subjectType}<br/><code>{e.subjectId??"—"}</code></span>},
  {key:"requestId",header:"Request ID",minWidth:200,render:e=><BoDataGridCanonicalId value={e.requestId}/>},
 ],[]);
 return <section aria-label="Head Office Access Audit" className="ho-audit">
  <header className="page-heading"><div className="page-heading-left"><h1>Access Audit<small>Head Office · Read only · Access events only</small></h1></div></header>
  <p className="ho-audit-description">Lịch sử quản trị quyền truy cập. Không bao gồm nhật ký hoạt động kinh doanh hoặc payload nhạy cảm.</p>
  <BoDataGrid
   rows={result.events} columns={cols} rowKey={e=>e.id} caption="Access Audit"
   state={loading?"loading":error?"error":"ready"} stateMessage={error||undefined}
   search={query} onSearchChange={v=>{setLoading(true);setError("");setPage(1);setQuery(v);}} searchPlaceholder="Tìm action, actor, target, request ID..."
   toolbarActions={<label className="ho-audit-outcome">Result <select aria-label="Filter Access Audit result" value={outcome} onChange={e=>{setLoading(true);setPage(1);setOutcome(e.target.value);}}><option value="">All</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="denied">Denied</option></select></label>}
   resultLabel={result.page.total+" access events"}
   onRefresh={()=>{setLoading(true);setReload(i=>i+1);}}
   pagination={{page,pageSize:size,total:result.page.total,pageSizeOptions:sizes,onPageChange:n=>{setLoading(true);setPage(n);},onPageSizeChange:n=>{setLoading(true);setPage(1);setSize(n);}}}
   selectedRowKey={selectedId}
   onRowOpen={e=>setSelectedId(e.id)}
   rowsAlreadyFiltered
   emptyTitle="Không có Access Audit" emptyMessage="Thử thay đổi từ khóa hoặc kết quả."
  />
  {selected?<BoDataGridSidePeek title={selected.action} eyebrow={new Date(selected.occurredAt).toLocaleString("vi-VN")} onClose={()=>setSelectedId(null)}>
   <dl className="ho-audit-details">
    <dt>Result</dt><dd><BoDataGridStatus value={selected.outcome} tone={tone(selected.outcome)}/></dd>
    <dt>Event ID</dt><dd><BoDataGridCanonicalId value={selected.id}/></dd>
    <dt>Request ID</dt><dd><BoDataGridCanonicalId value={selected.requestId}/></dd>
    <dt>Actor</dt><dd>{selected.actorType}: {selected.actorId??"system"}</dd>
    <dt>Target</dt><dd>{selected.subjectType}: {selected.subjectId??"—"}</dd>
   </dl>
   <p className="ho-audit-note">Payload ẩn từ server theo chính sách HO read-only.</p>
  </BoDataGridSidePeek>:null}
 </section>;
}
