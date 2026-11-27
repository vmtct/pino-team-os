"use client";
/** PAP-2425 local synthetic review only; not mounted by the live BO route. */
import {useMemo,useState,useSyncExternalStore} from "react";
import {TddRegistry,type AuthorizationContext,type TddActionBindings,type ModuleRow} from "@/lib/workspace-schema";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {createAssignmentM1Navigation} from "./assignment-m1-navigation";
import type {AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {expandedAssignmentQuery,registerExpandedAssignment,type ExpandedAssignmentFields} from "./assignment-expanded-schema";
import {ASSIGNMENT_M1_ID,ASSIGNMENT_M1_CENTER,staffAssignmentM1,staffAssignmentM1Row} from "./assignment-m1-fixture";
import {assignmentPresentationScope} from "./assignment-subject-presentation";
type F=ExpandedAssignmentFields;
const READ="student.mission_assignment.view",EDIT="student.mission_assignment.manage";
type SampleState={completed:boolean;version:number;executionVersion:number;contextLabel:string|null};
type SampleStore={read:()=>SampleState;write:(next:SampleState)=>void};
export function createAssignmentM1Adapter(completed:boolean,version:number,shared?:SampleStore):AuthenticatedSurfaceAdapter<F>{
 let local:SampleState={completed,version,executionVersion:version,contextLabel:null};
 const store=shared??{read:()=>local,write:(next:SampleState)=>{local=next;}};
 const subject={...staffAssignmentM1,execution:completed?"COMPLETED" as const:"IN_PROGRESS" as const};
 const row=():ModuleRow<F>=>{const current=store.read();return {...staffAssignmentM1Row,executionStatus:current.completed?"Hoàn tất":"Đang thực hiện",executionVersion:current.executionVersion,context:current.contextLabel};};
 const registry=new TddRegistry(),schema=registerExpandedAssignment(registry,subject,row);
 const context:AuthorizationContext=Object.freeze({surface:"BO",centerId:ASSIGNMENT_M1_CENTER,authorize:(key:string)=>key===READ||key===EDIT});
 return {registry,schema,context,scope:{surface:"BO",centerId:ASSIGNMENT_M1_CENTER},userId:"PAP2425_SYNTHETIC_ONLY",
  capabilities:{read:true,edit:true,create:false,delete:false,reveal:false,audit:false},
  list:async(_query,signal)=>{signal.throwIfAborted();const current=row();return {rows:[current],total:1,versions:{[current.id]:String(store.read().version)}};},
  detail:async(id,signal)=>{signal.throwIfAborted();return id===ASSIGNMENT_M1_ID?{row:row(),version:String(store.read().version),centerId:ASSIGNMENT_M1_CENTER}:null;},
  mutation:{update:async(id,patch,expectedVersion,authorization,signal)=>{
   signal.throwIfAborted();
   if(authorization!==context||id!==ASSIGNMENT_M1_ID||!context.authorize(EDIT))return {status:"denied"};
   const current=store.read();
   if(expectedVersion!==String(current.version))return {status:"conflict"};
   const keys=Object.keys(patch);
   if(keys.length!==1||keys[0]!=="context")return {status:"invalid",fields:[]};
   const value=patch.context;
   if(value!==null&&(typeof value!=="string"||value.trim().length>200))return {status:"invalid",fields:["context"]};
   const next={...current,version:current.version+1,contextLabel:value?.trim()||null};
   store.write(next);
   return {status:"saved",row:row(),version:String(next.version)};
  }},
  views:async()=>({unavailable:[]}),subject:id=>({type:"assignment_m1",id}),
  history:async()=>({status:"unavailable",reason:"M1 · Chưa kết nối lịch sử thật."}),dispose:()=>{}};
}
export function MissionAssignmentM1({initialRecord}:{initialRecord?:string}){
 const navigation=useMemo(()=>createAssignmentM1Navigation(initialRecord),[initialRecord]);
 return <MissionAssignmentM1Content navigation={navigation}/>;
}
/** Shared isolated fixture UI; no live command transport. */
export function MissionAssignmentM1Content({navigation}:{navigation:AdapterNavigation<F>}){
 const selected=useSyncExternalStore(navigation.subscribe,navigation.read,navigation.read);
 const [store]=useState(()=>{
  let value:SampleState={completed:false,version:0,executionVersion:0,contextLabel:null};
  const listeners=new Set<()=>void>();
  return {read:()=>value,write:(next:SampleState)=>{value=next;listeners.forEach(fn=>fn());},
   subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};}};
 });
 const execution=useSyncExternalStore(store.subscribe,store.read,store.read);
 const [form,setForm]=useState<"complete"|"reopen"|null>(null),[reason,setReason]=useState("");
 const [notice,setNotice]=useState("");
 const adapter=useMemo(()=>createAssignmentM1Adapter(execution.completed,execution.version,store),[execution.completed,execution.version,store]);
 const scope=assignmentPresentationScope({...staffAssignmentM1,execution:execution.completed?"COMPLETED":"IN_PROGRESS"});
 const detail=selected.kind==="detail"&&selected.recordId===ASSIGNMENT_M1_ID;
 const close=()=>{setForm(null);setReason("");};
 const apply=(completed:boolean)=>{const latest=store.read();store.write({...latest,completed,version:latest.version+1,executionVersion:latest.executionVersion+1});close();setNotice(completed?"M1 · Đã xác nhận hoàn tất (mẫu).":"M1 · Đã mở lại nhiệm vụ (mẫu).");};
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
