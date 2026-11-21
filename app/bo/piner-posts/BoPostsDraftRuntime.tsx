"use client";
/** PAP-2134: approved native DSA, controlled by the shared browser TDD navigation. */
import {useContext,useEffect,useRef,useState,useMemo} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddDetail,RecordState} from "@/app/components/workspace-renderer/Record";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation} from "@/lib/workspace-adapters/navigation";
import type {TableQuery,ModuleRow} from "@/lib/workspace-schema";
import type {BoRecord,BoValue} from "@/lib/bo-registration";
import {postModule} from "./schema";
import {draftSchema,draftQuery,type DraftFields} from "./native-draft-binding";
import type {NativeDraftSession} from "./native-draft-session";
import {CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import {NativePrivateMediaPanel} from "./NativePrivateMediaPanel";
import {resolveStudent,type StudentChoice} from "./data-port";
type Row=ModuleRow<DraftFields>;
type State="loading"|"ready"|"error"|"denied";
const blank=(center:string):BoRecord=>({id:"",name:"",caption:"",author:"PINO Afterschool",status:"Nháp",center,source:"Chưa có",mediaCount:0,commentCount:0,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null});
function errorText(e:unknown){return e instanceof Error?e.message:"Không thể tải hoặc lưu Post.";}
export function BoPostsDraftRuntime({session,centerLabel}:{session:NativeDraftSession;centerLabel:string}){
 return <ScopedDraft key={session.userId+":"+session.controller.centerId} session={session} centerLabel={centerLabel}/>;
}
function ScopedDraft({session,centerLabel}:{session:NativeDraftSession;centerLabel:string}){
 const {registry,context,controller,mutation}=session,menu=useContext(TddHostMenu);
 const navigation=useMemo(()=>browserTddNavigation("BO","piner-posts",draftQuery),[]);
 const [position,setPosition]=useState(()=>navigation.read());
 const [reload,setReload]=useState(0);
 const [listResult,setListResult]=useState<{generation:number;rows:readonly Row[];status:State}|null>(null);
 const listCurrent=listResult?.generation===reload?listResult:null;
 const rows=listCurrent?.rows??[],status=listCurrent?.status??"loading";
 const [recordRetry,setRecordRetry]=useState(0);
 const [detailResult,setDetailResult]=useState<{id:string;generation:number;record:CoreDraftRow|null;status:State}|null>(null);
 const [draft,setDraft]=useState<BoRecord|null>(null),[choices,setChoices]=useState<readonly StudentChoice[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const active=useRef<AbortController|null>(null),previousStage=useRef(position.kind),restore=useRef(false);
 const allowed=context.authorize("piner.post.view");
 const selected=position.kind==="table"?undefined:position.recordId;
 const currentDetail=detailResult?.id===selected&&detailResult?.generation===recordRetry?detailResult:null;
 const record=currentDetail?.record??null,recordStatus=currentDetail?.status??"loading";
 const resetDraft=()=>{active.current?.abort();active.current=null;setDraft(null);setChoices([]);setBusy(false);setError("");};
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
 const create=()=>{if(active.current||!session.canCreate())return;setDraft(blank(centerLabel));perform(async signal=>{const data=await session.studentChoices(signal);signal.throwIfAborted();setChoices(data);});};
 const change=(key:string,value:BoValue)=>{if(key==="name"||key==="caption"){setDraft(old=>old?{...old,[key]:String(value??"")}:old);setError("");}};
 const submit=()=>{if(!draft||!session.canCreate())return;const student=resolveStudent(choices,draft.name);if(!student){setError("Chọn học viên có định danh duy nhất.");return;}perform(async signal=>{const row=await controller.createDraft(student.id,String(draft.caption??""),signal);signal.throwIfAborted();setReload(n=>n+1);move("drawer",row.id);});};
 const saved=(row:Row,version:string)=>{if(!record||record.id!==row.id||typeof row.name!=="string"||!row.name.trim())return;const nextVersion=Number(version),mediaCount=row.mediaCount;if(!Number.isSafeInteger(nextVersion)||nextVersion<=record.version||typeof mediaCount!=="number"||!Number.isSafeInteger(mediaCount)||mediaCount<0||mediaCount>5)return;setDetailResult({id:record.id,generation:recordRetry,record:{...record,...row,name:row.name,version:nextVersion,mediaCount},status:"ready"});setReload(n=>n+1);};
 const updateQuery=(query:TableQuery<DraftFields>)=>navigation.change({...position,query},true);
 const visibleRecord=record?.id===selected&&recordStatus==="ready"?record:null;
 if(!allowed)return <RecordState status="denied"/>;
 return <>
  <div hidden={position.kind==="detail"}><TddRenderer view={{kind:"table",headerActions:session.canCreate()?<button className="primary-btn" type="button" disabled={busy||status!=="ready"} onClick={create}>Tạo mới</button>:null,props:{registry,schema:draftSchema,context,rows,query:position.query,status,onRetry:()=>setReload(n=>n+1),onQueryChange:updateQuery,onOpen:r=>open(r.id)}}}/></div>
  {position.kind!=="table"&&!visibleRecord?<section>{menu("posts-record-menu")}<RecordState status={recordStatus} onRetry={()=>setRecordRetry(n=>n+1)}/><button type="button" onClick={close}>Quay lại</button></section>:null}
  {position.kind==="detail"&&visibleRecord?<TddDetail registry={registry} schema={draftSchema} context={context} record={visibleRecord} subject={{type:"piner_post_draft",id:visibleRecord.id}} activeTab={position.tab} onTabChange={tab=>move("detail",visibleRecord.id,tab,true)} renderApprovedExtension={(row,_ctx,tab)=>tab==="media"?<NativePrivateMediaPanel key={row.id} session={session} postId={row.id} onVerified={fresh=>{if(fresh.id===visibleRecord.id&&fresh.version>=visibleRecord.version&&(fresh.version!==visibleRecord.version||fresh.mediaCount!==visibleRecord.mediaCount)){setDetailResult(old=>old?.id===fresh.id&&old.generation===recordRetry&&old.record&&old.record.version<=fresh.version?{...old,record:fresh,status:"ready"}:old);setReload(n=>n+1);}}}/>:null} mobileMenu={menu("posts-detail-menu")} onBack={close} writes={{adapter:mutation,version:String(visibleRecord.version),onSaved:saved}}/>:null}
  {draft||position.kind==="drawer"&&visibleRecord?<BoQuickView key={draft?"create":visibleRecord!.id} module={postModule} moduleKey="piner-posts" record={draft?null:visibleRecord?{...visibleRecord,name:String(visibleRecord.name??"")}:null} onClose={close} onDetail={()=>{if(!draft&&visibleRecord)move("detail",visibleRecord.id);}}
   create={draft?{draft,editable:f=>!busy&&session.canCreate()&&["name","caption"].includes(f.key),editorField:f=>f.key==="name"?{...f,type:"relation",options:[...new Set(choices.map(c=>c.label))],readonly:false}:{...f,readonly:false},onChange:change,onCreate:submit,busy,error,title:"Tạo Post",path:"Piner App / Posts"}:undefined}/>:null}
 </>;
}
