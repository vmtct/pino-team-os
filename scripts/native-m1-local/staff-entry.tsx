/** PAP-2345 / PLT-M1-DELIVERY: local-only presentation entry, never a live session. */
import {createRoot} from "react-dom/client";
import {useEffect,useMemo,useState} from "react";
import {BoStaffsViews,type StaffsView} from "@/app/bo/components/registration/BoStaffsViews";
import {parseStaffLocalRoute,staffLocalRouteSearch,isStaffLocalTab,STAFF_LOCAL_RECORD} from "@/app/ho/staff/staff-local-route-state";
import {hoStaffViewRows,parseHoStaffView} from "@/app/ho/staff/staff-navigation-view";
import {localStaffReviewDefinition,verifyLocalStaffPreviewApproval} from "@/app/ho/staff/staff-access-admission";
import {StaffAccessPresentation} from "@/app/ho/staff/StaffAccessPresentation";
import {readStaffRecordSample,commitStaffRecordSample,extraSampleCenter} from "@/app/ho/staff/staff-record-sample";
import type {AccountInlineSample} from "@/app/ho/staff/staff-account-inline-sample";
import type {Snapshot,RoleChoice} from "@/app/ho/staff/staff-access-presentation-model";
import {StaffRegistrationQueue} from "@/app/ho/staff/StaffRegistrationQueue";
import {registrationQueueDefinition,registrationQueueQuery} from "@/app/ho/staff/staff-registration-queue-contract";
import {connectFinalizationDirectory} from "@/app/ho/staff/staff-finalization-directory-preview";
import {reviewedDossierSeed,finalizationRoleOptions} from "@/app/ho/staff/staff-registration-finalization-preview";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {StaffManualWorkspace} from "@/app/ho/staff/StaffManualWorkspace";
import {manualStaffDefinition,manualStaffQuery,type ManualStaffFields} from "@/app/ho/staff/manual-create-contract";
import {readStaffPreview,staffPreviewCenter,projectStaffPreviewRow} from "@/app/ho/staff/manual-create-preview";
import {newActivationPreview,activateFixture,createInactiveFixture,fixtureSubject} from "@/app/ho/staff/staff-activation-preview";
import {StaffRateSample} from "@/app/ho/staff/StaffRateSample";
import {createLocalStaffRateAction} from "@/app/ho/staff/staff-rate-local-action";
import {activationPersonReader,fixturePerson} from "@/app/ho/staff/staff-activation-baseline-preview";
import {TddRegistry,validateQuery,type AuthorizationContext,type ModuleSchema} from "@/lib/workspace-schema";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters/contracts";
import type {AdapterNavigation,AdapterLocation} from "@/lib/workspace-adapters/navigation";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {hoModules} from "@/lib/ho-system";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
import "./staff-navigation.css";

const route="/ho/staff", event="pino:m1:staff:local";
const origin=location.origin.toLowerCase();
const params=new URLSearchParams(location.search);
if(!["http://desktop-isrdren:8800","http://192.168.1.6:8800"].includes(origin)||location.pathname!==route||self.origin!=="null"||
  !parseStaffLocalRoute(params))throw Error("Local sandbox only");
const principal="synthetic-presentation-only";
let state=newActivationPreview(principal,true);
const personReader=activationPersonReader(()=>state.records.some(row=>row.existingPersonId===fixturePerson.id));
const rateAction=createLocalStaffRateAction(id=>!!fixtureSubject(state,id));
// This value is a display filter for synthetic rows only. No authenticated session or
// transport is created and the value cannot leave this sandbox or grant live access.
const context:AuthorizationContext=Object.freeze({surface:"HO",authorize:(permission:string)=>permission===manualStaffDefinition.capabilities.read||permission==="staff.compensation.manage"});
const registry=new TddRegistry(verifyLocalStaffPreviewApproval);
const schema:ModuleSchema<ManualStaffFields>=registry.register({...localStaffReviewDefinition,detail:{...localStaffReviewDefinition.detail,overview:{sections:manualStaffDefinition.detail.overview.sections.map(s=>s.id==="staff-info"?{...s,fields:s.fields.filter(k=>k!=="role"&&k!=="loginEmail")}:s)}},data:{id:"local-synthetic-presentation",list:async(query,_context,signal)=>{
  signal.throwIfAborted();validateQuery(schema,query,context);return {rows:state.records.map(projectStaffPreviewRow),total:state.records.length};
},detail:async(id,_context,signal)=>{signal.throwIfAborted();const row=readStaffPreview(state,id);return row?projectStaffPreviewRow(row):null;}}});
const adapter:AuthenticatedSurfaceAdapter<ManualStaffFields>={
  registry,schema,context,scope:{surface:"HO"},userId:principal,
  capabilities:{read:true,edit:false,create:false,delete:false,reveal:false,audit:false},
  list:async(query,signal)=>({...await schema.data.list(query,context,signal),versions:{}}),
  detail:async(id,signal)=>{const row=await schema.data.detail(id,context,signal);return row?{row}:null;},
  views:async signal=>{signal.throwIfAborted();return {unavailable:[]};},
  subject:id=>({type:"staffs",id}),history:async()=>({status:"unavailable",reason:"Chưa có nhật ký hệ thống cho Staff."}),dispose:()=>{}
};
const registration=connectFinalizationDirectory(reviewedDossierSeed,finalizationRoleOptions,()=>state,next=>{state=next;});
const dossierRow=()=>{const d=registration.fixture.dossier(),result=registration.fixture.readback();return {id:d.id,name:d.name,email:d.email,phone:d.mobile,center:staffPreviewCenter.label,status:result?.kind==="approved"?"Đã phê duyệt":result?.kind==="rejected"?"Từ chối":"Chờ HO phê duyệt",role:null,loginEmail:null,gender:null,birthDate:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};};
const queueRegistry=new TddRegistry();
const queueSchema:ModuleSchema<ManualStaffFields>=queueRegistry.register({...registrationQueueDefinition,data:{id:"local-reviewed-dossier",list:async(_q,_c,s)=>{s.throwIfAborted();return {rows:[dossierRow()],total:1};},detail:async(id,_c,s)=>{s.throwIfAborted();return id===reviewedDossierSeed.id?dossierRow():null;}}});
const queueAdapter:AuthenticatedSurfaceAdapter<ManualStaffFields>={...adapter,registry:queueRegistry,schema:queueSchema,list:async(q,s)=>({...await queueSchema.data.list(q,context,s),versions:{}}),detail:async(id,s)=>{const row=await queueSchema.data.detail(id,context,s);return row?{row}:null;}};
let focus:HTMLElement|null=null,recordId:string|undefined,scroll={x:0,y:0,left:0,top:0};
const validId=(id:string|null|undefined):id is string=>typeof id==="string"&&/^STAFF-MOCK-\d{3,}$/.test(id);
const navigation:AdapterNavigation<ManualStaffFields>={
 read(){const pinned=parseStaffLocalRoute(new URLSearchParams(location.search));if(!pinned)throw Error("Unknown Staff route state");const owned=history.state?.[event] as AdapterLocation<ManualStaffFields>|undefined;const ephemeral=pinned.kind==="table"&&owned&&owned.kind!=="table"&&validId(owned.recordId)&&owned.recordId!==STAFF_LOCAL_RECORD&&!!fixtureSubject(state,owned.recordId)&&isStaffLocalTab(owned.tab);return ephemeral?{...owned,query:owned.query??manualStaffQuery}:{...pinned,query:owned?.query??manualStaffQuery};},
 change(next,replace=false){if(next.kind!=="table"&&(!validId(next.recordId)||!fixtureSubject(state,next.recordId)))throw Error("Synthetic record required");const search=staffLocalRouteSearch(next);history[replace?"replaceState":"pushState"]({...history.state,[event]:next},"",location.pathname+search);window.dispatchEvent(new Event(event));},
 subscribe(listener){window.addEventListener("popstate",listener);window.addEventListener(event,listener);return()=>{window.removeEventListener("popstate",listener);window.removeEventListener(event,listener);};},
 capture(id){recordId=id;focus=document.activeElement instanceof HTMLElement?document.activeElement:null;const table=document.getElementById("table-scroll");scroll={x:window.scrollX,y:window.scrollY,left:table?.scrollLeft??0,top:table?.scrollTop??0};},
 restore(){requestAnimationFrame(()=>{window.scrollTo(scroll.x,scroll.y);const table=document.getElementById("table-scroll");if(table){table.scrollLeft=scroll.left;table.scrollTop=scroll.top;}const el=focus?.isConnected?focus:[...document.querySelectorAll<HTMLElement>("button[data-open]")].find(n=>n.dataset.open===recordId);el?.focus({preventScroll:true});});}
};
const queueEvent=event+":queue";
const queueNavigation:AdapterNavigation<ManualStaffFields>={
 read(){const owned=history.state?.[queueEvent] as AdapterLocation<ManualStaffFields>|undefined;return owned&&(owned.kind==="table"||owned.recordId===reviewedDossierSeed.id)?owned:{kind:"table",tab:"overview",query:registrationQueueQuery};},
 change(next,replace=false){if(next.kind!=="table"&&next.recordId!==reviewedDossierSeed.id)throw Error("Foreign dossier");history[replace?"replaceState":"pushState"]({...history.state,[queueEvent]:next},"",location.pathname);window.dispatchEvent(new Event(queueEvent));},
 subscribe(listener){window.addEventListener("popstate",listener);window.addEventListener(queueEvent,listener);return()=>{window.removeEventListener("popstate",listener);window.removeEventListener(queueEvent,listener);};},
 capture:navigation.capture,restore:navigation.restore
};
let decisionSequence=0;
const newDecisionKey=()=>"HO-M1-DECISION-"+String(++decisionSequence);
const source:BoWorkspaceSource={surface:"ho",readOnly:true,ephemeral:true,modules:hoModules,routeForModule:key=>key==="staffs"?route:"#unavailable-local-module",scopeLabel:()=>"",load:async()=>{throw Error("No live transport");}};
const accessCenters=[{...staffPreviewCenter,active:true},extraSampleCenter];
const accessRoles:RoleChoice[]=finalizationRoleOptions.map(r=>({id:r.id,label:r.label,active:r.active,protected:false,scopes:r.scopes}));
function accessSnapshot(id:string):Snapshot|null{const record=readStaffRecordSample(state,id);if(record?.snapshot.accountId)return record.snapshot;const subject=fixtureSubject(state,id);if(!subject)return null;const decision=registration.fixture.readback(),receipt=decision?.kind==="approved"&&decision.receipt.staffId===id?decision.receipt:null;return {staffId:id,revision:Number(subject.revision),employment:subject.status==="Đang làm"?"active":"inactive",accountStatus:subject.accountState,accountId:receipt?.userId??null,affiliationIds:subject.affiliation?.active?[subject.affiliation.centerId]:[],assignments:receipt&&(receipt.scopeType==="GLOBAL"||receipt.scopeId===reviewedDossierSeed.centerId)?[{id:"HO-M1-RECEIPT:"+receipt.staffId,roleId:receipt.roleId,scope:receipt.scopeType==="GLOBAL"?{type:"GLOBAL",id:null}:{type:"CENTER",id:staffPreviewCenter.id},protected:false}]:[]};}
function persistAccess(before:AccountInlineSample,next:AccountInlineSample){const record=readStaffRecordSample(state,before.snapshot.staffId);if(!record||JSON.stringify(record.snapshot)!==JSON.stringify(before.snapshot)||record.loginEmail!==before.loginEmail)return false;if(next===before)return true;const catalog=[...accessRoles,{id:"M1-FOUR-SCOPE-ROLE",label:"Custom role (M1 sample)",active:true,protected:false,scopes:["CENTER","GLOBAL","PATH","RUNNING_CLASS"] as const}];const updated=commitStaffRecordSample(state,record,{...next,credential:record.credential},catalog,accessCenters);if(!updated)return false;state=updated;return true;}
function StaffLocalContent(){
 const [view,setView]=useState<StaffsView>(()=>parseHoStaffView(history.state?.staffDirectoryView));
 useEffect(()=>{const sync=()=>setView(parseHoStaffView(history.state?.staffDirectoryView));window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[]);
 const select=(next:StaffsView)=>{if(next===view)return;history.pushState({...history.state,staffDirectoryView:next,[event]:{kind:"table",tab:"overview",query:manualStaffQuery},[queueEvent]:{kind:"table",tab:"overview",query:registrationQueueQuery}},"",location.pathname);setView(next);};
 const tabs=<div data-ho-staff-views><BoStaffsViews selected={view} onSelect={select}/></div>;
 const directory=useMemo<AuthenticatedSurfaceAdapter<ManualStaffFields>>(()=>({...adapter,list:async(q,s)=>{const result=await adapter.list(q,s);const rows=hoStaffViewRows(result.rows,view);return {...result,rows,total:rows.length};}}),[view]);
 return view==="register"?<StaffRegistrationQueue adapter={queueAdapter} fixture={registration.fixture} centerLabel={staffPreviewCenter.label} onBack={()=>select("all")} tableHeaderActions={tabs} navigation={queueNavigation} newKey={newDecisionKey} finalize={registration.finalize} reject={registration.fixture.reject}/>:<StaffManualWorkspace key={view} adapter={directory} navigation={navigation} centers={[staffPreviewCenter]} allowLogin={false} personReader={personReader} tableHeaderActions={tabs} detailSlots={{detailApprovedExtension:(row,context,tab)=>{if(tab==="staff-rate")return <StaffRateSample key={row.id} recordId={row.id} context={context} action={rateAction}/>;if(tab!=="access")return null;const snapshot=accessSnapshot(row.id);return snapshot?<StaffAccessPresentation key={snapshot.staffId+":"+snapshot.revision} snapshot={snapshot} centers={accessCenters} roles={accessRoles} persist={persistAccess} loginEmail={typeof row.loginEmail==="string"?row.loginEmail:null}/>:null;}}} onCreate={async command=>{state=createInactiveFixture(state,command);}} activation={{subject:id=>fixtureSubject(state,id),activate:async request=>{const next=activateFixture(state,request);state=next.state;return next.result;}}}/>;
}
createRoot(document.getElementById("root")!).render(<BoRegistrationWorkspace source={source} moduleKey="staffs" currentUser={{displayName:"M1 · Dữ liệu mẫu"}} content={<TddPreferencePolicy.Provider value="ephemeral"><StaffLocalContent/></TddPreferencePolicy.Provider>}/>);
