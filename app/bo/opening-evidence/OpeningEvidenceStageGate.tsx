"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BoDataGrid,BoDataGridBadge,BoDataGridSidePeek,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {openingEvidenceApi,type OpeningEvidenceRow,type EvidenceStatus,type SubjectType} from "@/lib/bo-opening-evidence-api";

export const statusLabels:Record<EvidenceStatus,string>={PENDING:"Chờ duyệt",APPROVED:"Đã duyệt",REJECTED:"Từ chối"};
export const subjectLabels:Record<SubjectType,string>={CLASS:"Lớp học",RECEPTION:"Tiếp tân"};
export function evidenceProperties(r:OpeningEvidenceRow){
  return [
    ["Loại",subjectLabels[r.subjectType]],["Lớp / Ca",r.subjectLabel],["Ngày",r.workDate],
    ["Mở lúc",r.openedAt],["Submitted By",r.submittedByLegalFullName??"—"],["Trạng thái",statusLabels[r.status]],
    ["Created Time",r.openedAt],["Created By","Hệ thống"],["Last Modified Time",r.lastModifiedAt],
    ["Last Modified By",r.lastModifiedByLegalFullName??"—"],
  ].map(([label,value])=>({key:label!,label:label!,value}));
}
const columns:BoDataGridColumn<OpeningEvidenceRow>[]=[
  {key:"subjectType",header:"Loại",render:r=>subjectLabels[r.subjectType],minWidth:100},
  {key:"subjectLabel",header:"Lớp / Ca",render:r=>r.subjectLabel,minWidth:150},
  {key:"workDate",header:"Ngày",render:r=>r.workDate,minWidth:115},
  {key:"submittedByLegalFullName",header:"Submitted By",render:r=>r.submittedByLegalFullName??"—",minWidth:160},
  {key:"status",header:"Trạng thái",render:r=><BoDataGridBadge>{statusLabels[r.status]}</BoDataGridBadge>,minWidth:120},
  {key:"openedAt",header:"Created Time",render:r=>r.openedAt,minWidth:150},
  {key:"createdBy",header:"Created By",render:()=>"Hệ thống",minWidth:120},
  {key:"lastModifiedAt",header:"Last Modified Time",render:r=>r.lastModifiedAt,minWidth:150},
  {key:"lastModifiedBy",header:"Last Modified By",render:r=>r.lastModifiedByLegalFullName??"—",minWidth:160},
];
const rowKey=(r:OpeningEvidenceRow)=>r.subjectType+":"+r.openingReceiptId;
export const detailHref=(r:OpeningEvidenceRow)=>"/bo/opening-evidence/"+r.subjectType+"/"+encodeURIComponent(r.openingReceiptId)+"?centerId="+encodeURIComponent(r.centerId);
export function OpeningEvidenceStageGate(){
  const scope=useBoCenterSelection();
  const allowed=Boolean(scope&&!scope.loading&&!scope.error&&scope.selected&&scope.centers.some(center => center.id === scope.selected));
  return <ScopeView key={JSON.stringify([scope?.selected,allowed])} centerId={scope?.selected??""} allowed={allowed} loading={!scope||scope.loading}/>;
}
function ScopeView({centerId,allowed,loading}:{centerId:string;allowed:boolean;loading:boolean}){
  const [status,setStatus]=useState<EvidenceStatus|"ALL">("PENDING");
  const [type,setType]=useState<SubjectType|"ALL">("ALL");
  const [search,setSearch]=useState(""),[offset,setOffset]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [response,setResponse]=useState<{key:string;rows:OpeningEvidenceRow[];total:number;error:string}|null>(null);
  const key=JSON.stringify([centerId,status,type,search,offset]);
  useEffect(()=>{
    if(!allowed)return;
    const controller=new AbortController();
    void openingEvidenceApi.list({centerId,offset,limit:25,...(status!=="ALL"?{status}:{}),...(type!=="ALL"?{subjectType:type}:{}),
      ...(search.trim()?{search:search.trim()}:{})},controller.signal).then(result=>{
      if(!controller.signal.aborted)setResponse({key,...result,error:""});
    }).catch(error=>{if(!controller.signal.aborted)setResponse({key,rows:[],total:0,error:error instanceof Error?error.message:"Không thể tải Core."});});
    return()=>controller.abort();
  },[allowed,centerId,key,status,type,search,offset]);
  const current=allowed&&response?.key===key?response:null;
  const row=current?.rows.find(r=>rowKey(r)===selected);
  return <section aria-label="Mở lớp và ca" data-opening-evidence-phase="DEV_FIRST_UNADMITTED">
    <div className="page-heading"><div className="page-heading-left"><h1>Mở lớp &amp; ca</h1></div></div>
    {loading?<p role="status">Đang xác thực cơ sở…</p>:!allowed?<p role="alert">Chọn cơ sở được cấp quyền.</p>:<>
      <div className="view-tabs" role="group" aria-label="Trạng thái duyệt">
        {(["PENDING","APPROVED","REJECTED","ALL"] as const).map(s=><button type="button" key={s} aria-pressed={status===s} onClick={()=>{setStatus(s);setOffset(0);setSelected(null);}}>{s==="ALL"?"Tất cả":statusLabels[s]}</button>)}
      </div>
      <BoDataGrid rows={current?.rows??[]} columns={columns} rowKey={rowKey} caption="Mở lớp và ca"
        state={!current?"loading":current.error?"error":"ready"} stateMessage={current?.error??""}
        search={search} searchPlaceholder="Tìm lớp, ca, nhân viên" onSearchChange={s=>{setSearch(s);setOffset(0);setSelected(null);}}
        toolbarActions={<select aria-label="Loại mở" value={type} onChange={e=>{setType(e.target.value as SubjectType|"ALL");setOffset(0);setSelected(null);}}>
          <option value="ALL">Tất cả loại</option><option value="CLASS">Lớp học</option><option value="RECEPTION">Tiếp tân</option>
        </select>}
        onRowOpen={r=>setSelected(rowKey(r))} quickViewOpener
        resultLabel={String(current?.total??0)+" bản ghi"}
        pagination={{page:Math.floor(offset/25)+1,pageSize:25,total:current?.total??0,onPageChange:p=>{setOffset((p-1)*25);setSelected(null);}}}
        emptyTitle="Chưa có bằng chứng" emptyMessage="Core không trả về bản ghi trong phạm vi này."/>
    </>}
    {row?<BoDataGridSidePeek title={row.subjectLabel} eyebrow={subjectLabels[row.subjectType]} onClose={()=>setSelected(null)}
      footer={<Link href={detailHref(row)}>Chi tiết</Link>}>
      <BoProperties compact items={evidenceProperties(row)}/>
    </BoDataGridSidePeek>:null}
  </section>;
}
