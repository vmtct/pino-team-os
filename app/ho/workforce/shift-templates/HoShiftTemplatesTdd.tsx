"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { mapHoCenters, type HoCenterRow } from "@/lib/ho-centers";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { shiftTemplateDefinition,shiftTemplateFields,shiftTemplateQuery,createShiftTemplateProvider,verifyShiftTemplateExtensionApproval } from "./schema";
import { HoShiftTemplateEditor } from "./HoShiftTemplateEditor";
type F=typeof shiftTemplateFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
export function HoShiftTemplatesTdd(){
  const [centers,setCenters]=useState<HoCenterRow[]|null>(null);
  const [centerId,setCenterId]=useState("ALL");
  const [centerError,setCenterError]=useState("");
  const [ready,setReady]=useState<Ready|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [refresh,setRefresh]=useState(0);
  const [createOpen,setCreateOpen]=useState(false);
  useEffect(()=>{
    const ctrl=new AbortController();
    void boApi.centers((input,init)=>fetch(input,{...init,signal:ctrl.signal})).then(result=>{
      const rows=mapHoCenters(result).filter(row=>row.status.toUpperCase()==="ACTIVE");
      if(!ctrl.signal.aborted)setCenters(rows);
    }).catch(()=>{if(!ctrl.signal.aborted)setCenterError("Không tải được Center từ Core. Thử tải lại trang.");});
    return ()=>ctrl.abort();
  },[]);
  useEffect(()=>{
    if(!centerId)return;
    const ctrl=new AbortController();
    let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
    void createHoTddAdapter({
      registry:new TddRegistry(verifyShiftTemplateExtensionApproval),
      definition:shiftTemplateDefinition,provider:createShiftTemplateProvider(centerId),
    },ctrl.signal).then(value=>{
      adapter=value;
      if(ctrl.signal.aborted){value.dispose();return;}
      setReady({adapter:value,navigation:browserTddNavigation("HO","shiftTemplates",shiftTemplateQuery)});
    }).catch(()=>{if(!ctrl.signal.aborted)setError("Không khởi tạo được TDD Mẫu ca.");});
    return ()=>{ctrl.abort();adapter?.dispose();};
  },[centerId,retry]);
  const valid=Boolean(["ALL","GLOBAL"].includes(centerId)||centers?.some(c=>c.id===centerId));
  const content=<section aria-label="Quản lý Mẫu ca" data-testid="ho-shift-templates-tdd">
    <div className="property-row">
      <label htmlFor="ho-template-center">Center</label>
      <select id="ho-template-center" value={centerId} required disabled={!centers}
        onChange={event=>{setReady(null);setError("");setCreateOpen(false);setCenterId(event.target.value);setRefresh(0);}}>
        <option value="ALL">Tất cả phạm vi</option>
        <option value="GLOBAL">GLOBAL — mọi Center</option>
        {centers?.map(center=><option key={center.id} value={center.id}>{center.name}</option>)}
      </select>
    </div>
    {centerError?<p role="alert">{centerError}</p>:null}
    {!centers&&!centerError?<p role="status">Đang tải Center…</p>:null}
    {centers?.length===0?<p role="status">Không có Center đang hoạt động.</p>:null}
    {error?<p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(v=>v+1);}}>Thử lại</button></p>:null}
    {!valid&&centers?.length?<p role="status">Chọn Center để xem Mẫu ca.</p>:null}
    {valid&&ready?<div data-testid="ho-shift-templates-workspace">
      <HoShiftTemplateEditor key={"create:"+centerId} mode="create" centerId={centerId} centers={centers??[]} createOpen={createOpen}
        onCreateClose={()=>setCreateOpen(false)}
        authorized={ready.adapter.context.authorize("workforce.shift_template.ho_manage")}
        onSaved={()=>setRefresh(v=>v+1)}/>
      <SurfaceWorkspace key={centerId+":"+refresh} adapter={ready.adapter} navigation={ready.navigation}
        actionBindings={{openCreate:{kind:"navigation",run:()=>setCreateOpen(true)}}}
        initialQuery={shiftTemplateQuery}
        detailApprovedExtension={(row,context,activeTab,_principalId,onSaved)=>
          activeTab==="usage" ? <section className="v24-prop-section" aria-label="Sử dụng mẫu ca">
             <div className="v24-section-heading"><h4>Sử dụng mẫu ca</h4></div>
             <div className="v24-prop-grid">
               <div className="v24-prop-item"><span className="v24-prop-key">Lượt phân công</span><span className="v24-prop-value readonly">{row.assignmentCount??"Chưa có dữ liệu"}</span></div>
               <div className="v24-prop-item"><span className="v24-prop-key">Lượt đăng ký</span><span className="v24-prop-value readonly">{row.availabilityCount??"Chưa có dữ liệu"}</span></div>
               <div className="v24-prop-item"><span className="v24-prop-key">Phạm vi</span><span className="v24-prop-value readonly">{row.scopeType==="GLOBAL"?"GLOBAL · Mọi Center":centers?.find(c=>c.id===row.centerId)?.name??"Center"}</span></div>
               <div className="v24-prop-item"><span className="v24-prop-key">Tình trạng</span><span className="v24-prop-value readonly">{row.status==="ACTIVE"?"Đang sử dụng":"Tạm ngưng"}</span></div>
             </div>
           </section> : activeTab==="edit"||activeTab==="status"
            ? <HoShiftTemplateEditor key={row.id+":"+activeTab} mode={activeTab} centerId={row.scopeType==="GLOBAL"?"GLOBAL":String(row.centerId)} centers={centers??[]}
                templateId={row.id} authorized={context.authorize("workforce.shift_template.ho_manage")}
                onSaved={onSaved}/>
            :null}
      />
    </div>:valid&&!error?<p role="status">Đang tải Mẫu ca…</p>:null}
  </section>;
  return <HoWorkspace module="shiftTemplates" content={content}/>;
}
