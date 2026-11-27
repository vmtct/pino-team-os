"use client";
/** PAP-2425 local synthetic review only; not mounted by the live BO route. */
import {useMemo,useState,useSyncExternalStore} from "react";
import {TddRegistry,type AuthorizationContext,type TddActionBindings,type ModuleRow} from "@/lib/workspace-schema";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import type {AdapterLocation,AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {expandedAssignmentQuery,registerExpandedAssignment,type ExpandedAssignmentFields} from "./assignment-expanded-schema";
import {ASSIGNMENT_M1_ID,ASSIGNMENT_M1_CENTER,staffAssignmentM1,staffAssignmentM1Row} from "./assignment-m1-fixture";
import {assignmentPresentationScope} from "./assignment-subject-presentation";
type F=ExpandedAssignmentFields;
const READ="student.mission_assignment.view",EDIT="student.mission_assignment.manage";
export function createAssignmentM1Navigation(record?:string):AdapterNavigation<F>{
 if(record!==undefined&&record!==ASSIGNMENT_M1_ID)throw Error("Unknown synthetic record");
 let state:AdapterLocation<F>={kind:record?"drawer":"table",...(record?{recordId:record}:{}),tab:"overview",query:expandedAssignmentQuery};
 const listeners=new Set<()=>void>();let focus:HTMLElement|null=null;
 return {read:()=>state,change:next=>{
  if(next.kind!=="table"&&next.recordId!==ASSIGNMENT_M1_ID)throw Error("Unknown synthetic record");
  state=next;listeners.forEach(fn=>fn());
 },subscribe:fn=>{listeners.add(fn);return()=>{listeners.delete(fn);}},capture:()=>{focus=document.activeElement instanceof HTMLElement?document.activeElement:null;},restore:()=>{if(focus?.isConnected)focus.focus({preventScroll:true});}};
}
export function createAssignmentM1Adapter(completed:boolean,version:number):AuthenticatedSurfaceAdapter<F>{
 const subject={...staffAssignmentM1,execution:completed?"COMPLETED" as const:"IN_PROGRESS" as const};
 const row:ModuleRow<F>={...staffAssignmentM1Row,executionStatus:completed?"Hoàn tất":"Đang thực hiện",executionVersion:version};
 const registry=new TddRegistry(),schema=registerExpandedAssignment(registry,subject,row);
 const context:AuthorizationContext=Object.freeze({surface:"BO",centerId:ASSIGNMENT_M1_CENTER,authorize:(key:string)=>key===READ||key===EDIT});
 return {registry,schema,context,scope:{surface:"BO",centerId:ASSIGNMENT_M1_CENTER},userId:"PAP2425_SYNTHETIC_ONLY",
  capabilities:{read:true,edit:true,create:false,delete:false,reveal:false,audit:false},
  list:async(_query,signal)=>{signal.throwIfAborted();return {rows:[row],total:1,versions:{[row.id]:String(version)}};},
  detail:async(id,signal)=>{signal.throwIfAborted();return id===row.id?{row,version:String(version),centerId:ASSIGNMENT_M1_CENTER}:null;},
  views:async()=>({unavailable:[]}),subject:id=>({type:"assignment_m1",id}),
  history:async()=>({status:"unavailable",reason:"M1 · Chưa kết nối lịch sử thật."}),dispose:()=>{}};
}
export function MissionAssignmentM1({initialRecord}:{initialRecord?:string}){
 const navigation=useMemo(()=>createAssignmentM1Navigation(initialRecord),[initialRecord]);
 const selected=useSyncExternalStore(navigation.subscribe,navigation.read,navigation.read);
 const [execution,setExecution]=useState({completed:false,version:0});
 const [form,setForm]=useState<"complete"|"reopen"|null>(null),[reason,setReason]=useState("");
 const [notice,setNotice]=useState("");
 const adapter=useMemo(()=>createAssignmentM1Adapter(execution.completed,execution.version),[execution.completed,execution.version]);
 const scope=assignmentPresentationScope({...staffAssignmentM1,execution:execution.completed?"COMPLETED":"IN_PROGRESS"});
 const detail=selected.kind==="detail"&&selected.recordId===ASSIGNMENT_M1_ID;
 const close=()=>{setForm(null);setReason("");};
 const apply=(completed:boolean)=>{setExecution(current=>({completed,version:current.version+1}));close();setNotice(completed?"M1 · Đã xác nhận hoàn tất (mẫu).":"M1 · Đã mở lại nhiệm vụ (mẫu).");};
 const actions:TddActionBindings={
  openComplete:{kind:"navigation",visible:detail&&!form&&scope.showCompletionProposal,run:()=>setForm("complete")},
  openReopen:{kind:"navigation",visible:detail&&!form&&scope.showReopenProposal,run:()=>setForm("reopen")},
  cancelReopen:{kind:"navigation",visible:!!form,run:close},
  confirmReopen:{kind:"navigation",visible:!!form,disabled:form==="reopen"&&(reason.trim().length<10||reason.trim().length>500),run:()=>{if(form==="complete")apply(true);else if(form==="reopen"&&reason.trim().length>=10&&reason.trim().length<=500)apply(false);}},

 };
 return <section data-testid="bo-missions-tdd" aria-label="Nhiệm vụ tại Center">
  <p role="status">M1 · Dữ liệu mẫu. Không ghi Core, không cấp PLS hoặc chứng nhận.</p>
  {notice?<p role="status">{notice}</p>:null}
  <SurfaceWorkspace adapter={adapter} navigation={navigation} initialQuery={expandedAssignmentQuery} actionBindings={actions}/>
  {form?<TddRenderer view={{kind:"form",props:{registry:adapter.registry,schema:adapter.schema,context:adapter.context,mode:"edit",recordId:ASSIGNMENT_M1_ID,title:form==="complete"?"Xác nhận hoàn tất":"Mở lại nhiệm vụ",onClose:close,actionBindings:actions,content:<section className="v24-prop-section" aria-label="Xác nhận nhiệm vụ mẫu">
  <p><strong>{staffAssignmentM1Row.name}</strong> · {staffAssignmentM1Row.student}</p>
  {form==="reopen"?<label className="v25-form-field"><span>Lý do mở lại *</span><textarea className="edit-input" rows={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>:<p>Xác nhận nhân sự đã hoàn tất nội dung đào tạo. Thao tác mẫu không phát sinh thưởng hoặc chứng nhận.</p>}
  </section>}}}/>:null}
 </section>;
}
