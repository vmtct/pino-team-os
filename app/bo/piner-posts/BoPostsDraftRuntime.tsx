"use client";
/** PAP-2134: approved native DSA, controlled by the shared browser TDD navigation. */
import {useContext,useEffect,useRef,useState,useMemo} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddDetail,RecordState} from "@/app/components/workspace-renderer/Record";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import type {TableQuery,ModuleRow} from "@/lib/workspace-schema";
import {norm,type BoRecord,type BoValue} from "@/lib/bo-registration";
import {postModule} from "./schema";
import {draftSchema,draftQuery,type DraftFields} from "./native-draft-binding";
import type {DraftRuntimeSession} from "./post-preview-session";
import {CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import {NativePrivateMediaPanel} from "./NativePrivateMediaPanel";
import {resolvePerson,type PersonChoice,type PostProgramKey} from "./data-port";
type Row=ModuleRow<DraftFields>;
type State="loading"|"ready"|"error"|"denied";
const blank=(center:string):BoRecord=>({id:"",name:"",program:"PINO Afterschool",caption:"",author:"PINO Afterschool",status:"Nháp",center,source:"Chưa có",mediaCount:0,commentCount:0,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null});
const programKey=(label:unknown):PostProgramKey=>label==="MyTime by PINO"?"MYTIME":"AFTERSCHOOL";
const noPeople=(program:PostProgramKey)=>program==="MYTIME"?"Chưa có Person Guest đủ điều kiện tại MyTime của cơ sở này.":"Chưa có Person đủ điều kiện trong Afterschool của cơ sở này.";
function errorText(e:unknown){return e instanceof Error?e.message:"Không thể tải hoặc lưu Post.";}
export function BoPostsDraftRuntime({session,centerLabel,previewNavigation}:{session:DraftRuntimeSession;centerLabel:string;previewNavigation?:AdapterNavigation<DraftFields>}){
 return <ScopedDraft key={session.userId+":"+session.controller.centerId} session={session} centerLabel={centerLabel} previewNavigation={previewNavigation}/>;
}
function ScopedDraft({session,centerLabel,previewNavigation}:{session:DraftRuntimeSession;centerLabel:string;previewNavigation?:AdapterNavigation<DraftFields>}){
 const {registry,context,controller,mutation}=session,menu=useContext(TddHostMenu);
 const navigation=useMemo(()=>previewNavigation??browserTddNavigation("BO","piner-posts",draftQuery),[previewNavigation]);
 const [position,setPosition]=useState(()=>navigation.read());
 const [reload,setReload]=useState(0);
 const [listResult,setListResult]=useState<{generation:number;rows:readonly Row[];status:State}|null>(null);
 const listCurrent=listResult?.generation===reload?listResult:null;
 const rows=listCurrent?.rows??[],status=listCurrent?.status??"loading";
 const [recordRetry,setRecordRetry]=useState(0);
 const [detailResult,setDetailResult]=useState<{id:string;generation:number;record:CoreDraftRow|null;status:State}|null>(null);
 const [draft,setDraft]=useState<BoRecord|null>(null),[choices,setChoices]=useState<readonly PersonChoice[]>([]),[personSearch,setPersonSearch]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const active=useRef<AbortController|null>(null),previousStage=useRef(position.kind),restore=useRef(false);
 const allowed=context.authorize("piner.post.view");
 const selected=position.kind==="table"?undefined:position.recordId;
 const currentDetail=detailResult?.id===selected&&detailResult?.generation===recordRetry?detailResult:null;
 const record=currentDetail?.record??null,recordStatus=currentDetail?.status??"loading";
 const resetDraft=()=>{active.current?.abort();active.current=null;setDraft(null);setChoices([]);setPersonSearch("");setBusy(false);setError("");};
 useEffect(()=>navigation.subscribe(()=>{
   const next=navigation.read();
   if(previousStage.current!=="table"&&next.kind==="table")restore.current=true;
   previousStage.current=next.kind;resetDraft();setRecordRetry(n=>n+1);setPosition(next);
 }),[navigation]);
 useEffect(()=>{const ctl=new AbortController();if(!allowed)return()=>ctl.abort();
  void draftSchema.data.list(draftQuery,context,ctl.signal).then(x=>{if(!ctl.signal.aborted)setListResult({generation:reload,rows:x.rows,status:"ready"});},e=>{if(!ctl.signal.aborted)setListResult({generation:reload,rows:[],status:e instanceof CoreDraftRequestError&&[401,403].includes(e.status)?"denied":"error"});});
  return()=>ctl.abort();
 },[session,reload,allowed,context]);
 useEffect(()=>{const ctl=new AbortController();if(!selected||!allowed)return()=>ctl.abort();
  void controller.detail(selected,ctl.signal).then(value=>{if(!ctl.signal.aborted)setDetailResult({id:selected,generation:recordRetry,record:value,status:"ready"});},e=>{if(!ctl.signal.aborted)setDetailResult({id:selected,generation:recordRetry,record:null,status:e instanceof CoreDraftRequestError&&[401,403].includes(e.status)?"denied":"error"});});
  return()=>ctl.abort();
 },[controller,selected,allowed,recordRetry]);
 useEffect(()=>{if(restore.current&&position.kind==="table"&&status==="ready"){restore.current=false;navigation.restore();}},[position.kind,status,navigation]);
 useEffect(()=>()=>{active.current?.abort();},[session]);
 const move=(kind:"table"|"drawer"|"detail",id?:string,tab="overview",replace=false)=>navigation.change({kind,...(id?{recordId:id}:{}),tab,query:position.query},replace);
 const perform=(operation:(signal:AbortSignal)=>Promise<void>)=>{
  if(active.current)return;const ctl=new AbortController();active.current=ctl;setBusy(true);setError("");
  void operation(ctl.signal).catch(e=>{if(!ctl.signal.aborted)setError(errorText(e));}).finally(()=>{if(active.current===ctl){active.current=null;if(!ctl.signal.aborted)setBusy(false);}});
 };
 const close=()=>{resetDraft();if(position.kind!=="table")move("table");};
 const open=(id:string)=>{if(active.current)return;navigation.capture(id);move("drawer",id);};
 const create=()=>{if(active.current||!session.canCreate())return;setDraft(blank(centerLabel));setChoices([]);setPersonSearch("");perform(async signal=>{const data=await session.personChoices("AFTERSCHOOL",signal);signal.throwIfAborted();setChoices(data);if(!data.length)setError(noPeople("AFTERSCHOOL"));});};
 const change=(key:string,value:BoValue)=>{
  if(key==="program"){
   const selected=String(value??"PINO Afterschool"),program=programKey(selected);
   setChoices([]);setPersonSearch("");setDraft(old=>old?{...old,program:selected,name:""}:old);setError("");
   perform(async signal=>{const data=await session.personChoices(program,signal);signal.throwIfAborted();setChoices(data);if(!data.length)setError(noPeople(program));});
   return;
  }
  if(key==="name"||key==="caption"){setDraft(old=>old?{...old,[key]:String(value??"")}:old);setError("");}
 };
 const searchPerson=(value:string)=>{setPersonSearch(value);setDraft(old=>old?{...old,name:""}:old);setError("");};
 const selectPerson=(value:string)=>{setPersonSearch(value);setDraft(old=>old?{...old,name:value}:old);setError("");};
 const submit=()=>{
  if(!draft||!session.canCreate())return;
  const selectedProgram=programKey(draft.program),person=resolvePerson(choices,draft.name);
  if(!person){setError("Chọn đúng một Person đủ điều kiện cho chương trình và cơ sở.");return;}
  perform(async signal=>{
   try{const row=await controller.createDraft(person.id,selectedProgram,String(draft.caption??""),signal);signal.throwIfAborted();setReload(n=>n+1);move("drawer",row.id);}
   catch(e){
    if(e instanceof CoreDraftRequestError&&e.status===404&&e.operation==="create"&&!controller.hasUnresolvedCommand()){
     setChoices([]);setPersonSearch("");setDraft(old=>old?{...old,name:""}:old);
     try{const fresh=await session.personChoices(selectedProgram,signal);signal.throwIfAborted();setChoices(fresh);if(!fresh.length)setError(noPeople(selectedProgram));}catch{signal.throwIfAborted();}
    }
    throw e;
   }
  });
 };
 const saved=(row:Row,version:string)=>{if(!record||record.id!==row.id||typeof row.name!=="string"||!row.name.trim())return;const nextVersion=Number(version),mediaCount=row.mediaCount;if(!Number.isSafeInteger(nextVersion)||nextVersion<=record.version||typeof mediaCount!=="number"||!Number.isSafeInteger(mediaCount)||mediaCount<0||mediaCount>5)return;setDetailResult({id:record.id,generation:recordRetry,record:{...record,...row,name:row.name,version:nextVersion,mediaCount},status:"ready"});setReload(n=>n+1);};
 const submitForReview=()=>{if(!record||!session.submitPreview||record.status!=="Nháp")return;perform(async signal=>{const fresh=await session.submitPreview!(record.id,record.version,signal);signal.throwIfAborted();setDetailResult({id:fresh.id,generation:recordRetry,record:fresh,status:"ready"});setReload(n=>n+1);});};
 const submitAction=record&&(session.submitPreview||session.canSubmit?.())&&record.status==="Nháp"&&position.tab!=="media"?<button className="primary-btn" type="button" disabled={busy} onClick={()=>move("detail",record.id,"media")}>Xem trước &amp; gửi duyệt</button>:null;
 const updateQuery=(query:TableQuery<DraftFields>)=>navigation.change({...position,query},true);
 const visibleRecord=record?.id===selected&&recordStatus==="ready"?record:null;
 const canSubmitDraft=Boolean(draft&&session.canCreate()&&resolvePerson(choices,draft.name));
 const personLabel=String(draft?.name??"");
 const matchingPeople=personSearch.trim()?choices.filter(choice=>norm(choice.label).includes(norm(personSearch))):[];
 const showPersonSearchResults=Boolean(draft&&personSearch.trim()&&personSearch!==personLabel);
 const createFields=draft?{name:{
  id:"post-person-search",label:"Person",value:personLabel,onChange:selectPerson,required:true,disabled:busy||!session.canCreate(),
  control:<>
   <input id="post-person-search" className="edit-input edit-search" type="search" aria-label="Tìm Person" aria-autocomplete="list" aria-required="true" required aria-controls="post-person-options" aria-expanded={showPersonSearchResults} aria-invalid={Boolean(showPersonSearchResults&&!matchingPeople.length)} aria-describedby={!personSearch.trim()&&!personLabel?"post-person-search-hint":showPersonSearchResults&&!matchingPeople.length?"post-person-options":undefined} placeholder="Tìm Person..." value={personSearch} disabled={busy||!session.canCreate()} onChange={event=>searchPerson(event.target.value)} />
   {showPersonSearchResults?<div id="post-person-options" className="option-list">
    {matchingPeople.length?matchingPeople.map(choice=><button className="option-item" type="button" key={choice.id} onClick={()=>selectPerson(choice.label)}><span className="option-check" aria-hidden="true">＋</span>{choice.label}</button>):<p className="settings-hint" role="status">Không tìm thấy Person phù hợp.</p>}
   </div>:!personSearch.trim()&&!personLabel?<p id="post-person-search-hint" className="settings-hint">Nhập tên, tuổi hoặc 4 số cuối điện thoại để tìm Person.</p>:null}
  </>
 }}:undefined;
 if(!allowed)return <RecordState status="denied"/>;
 return <>
  <div hidden={position.kind==="detail"}><TddRenderer view={{kind:"table",headerActions:session.canCreate()?<button className="primary-btn" type="button" disabled={busy||status!=="ready"} onClick={create}>Tạo mới</button>:null,props:{registry,schema:draftSchema,context,rows,query:position.query,status,onRetry:()=>setReload(n=>n+1),onQueryChange:updateQuery,onOpen:r=>open(r.id)}}}/></div>
  {position.kind!=="table"&&!visibleRecord?<section>{menu("posts-record-menu")}<RecordState status={recordStatus} onRetry={()=>setRecordRetry(n=>n+1)}/><button type="button" onClick={close}>Quay lại</button></section>:null}
  {position.kind==="detail"&&visibleRecord?<TddDetail registry={registry} schema={draftSchema} context={context} record={visibleRecord} headerActions={submitAction} subject={{type:"piner_post_draft",id:visibleRecord.id}} activeTab={position.tab} onTabChange={tab=>move("detail",visibleRecord.id,tab,true)} renderApprovedExtension={(row,_ctx,tab)=>tab==="media"?<NativePrivateMediaPanel key={row.id} session={session} postId={row.id} afterschool={visibleRecord.programKey==="AFTERSCHOOL"} review={session.submitPreview||session.canSubmit?.()?{caption:String(visibleRecord.caption??""),status:String(visibleRecord.status),busy,error,onSubmit:session.submitPreview?submitForReview:undefined,onEditCaption:()=>move("detail",visibleRecord.id,"overview",true)}:undefined} readOnly={visibleRecord.status!=="Nháp"} onVerified={fresh=>{if(fresh.id===visibleRecord.id&&fresh.version>=visibleRecord.version&&(fresh.version!==visibleRecord.version||fresh.mediaCount!==visibleRecord.mediaCount)){setDetailResult(old=>old?.id===fresh.id&&old.generation===recordRetry&&old.record&&old.record.version<=fresh.version?{...old,record:fresh,status:"ready"}:old);setReload(n=>n+1);}}}/>:null} mobileMenu={menu("posts-detail-menu")} onBack={close} writes={visibleRecord.status!=="Nháp"?undefined:{adapter:mutation,version:String(visibleRecord.version),onSaved:saved}}/>:null}
  {draft||position.kind==="drawer"&&visibleRecord?<BoQuickView key={draft?"create":visibleRecord!.id} module={postModule} moduleKey="piner-posts" record={draft?null:visibleRecord?{...visibleRecord,name:String(visibleRecord.name??"")}:null} onClose={close} onDetail={()=>{if(!draft&&visibleRecord)move("detail",visibleRecord.id);}}
   extraSection={!draft&&visibleRecord&&(session.submitPreview||session.canSubmit?.())?<section className="v24-prop-section"><button type="button" className="secondary-btn" onClick={()=>move("detail",visibleRecord.id,"media")}>Media &amp; Diary</button>{error?<p role="alert">{error}</p>:null}</section>:undefined}
   create={draft?{draft,createFields,editable:f=>!busy&&session.canCreate()&&["program","name","caption"].includes(f.key),editorField:f=>f.key==="name"?{...f,type:"relation",options:[...new Set(choices.map(c=>c.label))],readonly:false}:f.key==="program"?{...f,type:"select",options:["PINO Afterschool","MyTime by PINO"],readonly:false}:{...f,readonly:false},onChange:change,onCreate:submit,busy:busy||!canSubmitDraft,error,title:"Tạo Post",path:"Piner App / Posts"}:undefined}/>:null}
 </>;
}
