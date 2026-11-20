"use client";
/** PAP-2147 / MT-GUEST — actual authenticated composition of the approved native UI. */
import {useContext,useEffect,useState} from "react";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {RecordState} from "@/app/components/workspace-renderer/Record";
import {TddRegistry} from "@/lib/workspace-schema";
import {bindSurface} from "@/lib/workspace-adapters/adapter";
import {surfaceSession,adapterError} from "@/lib/workspace-adapters/session";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {BoMyTimeGuests,type GuestPort,type VersionedGuest} from "./BoMyTimeGuests";
import {definition,READ,EDIT,CREATE,queryDefault,type GuestFields} from "./schema";
import {createGuest,guestProvider} from "./provider";
import {readScopedParentDirectory,readScopedParentDetail} from "../parents/provider";
import {createStandaloneParent,inferParentContactType} from "@/lib/bo-parent-create-client";
import {relationshipValue} from "@/lib/guest-intake-contract";
import {BoApiError} from "@/lib/bo-api-error";
import {finishGuestWithParent} from "./guardian-recovery";
import type {GuardianOption} from "./GuardianPreview";
type Ready={scopeKey:string;adapter:AuthenticatedSurfaceAdapter<GuestFields>;rows:VersionedGuest[];port:GuestPort;canCreate:boolean};
export function BoMyTimeGuestsTdd(){
 const selection=useBoCenterSelection(),menu=useContext(TddHostMenu);
 const centerId=!selection?.loading&&!selection?.error&&selection?.centers.some(c=>c.id===selection.selected)?selection.selected:"",source=selection?.source??"centers";
 const [retry,setRetry]=useState(0),[ready,setReady]=useState<Ready|null>(null),[failed,setFailed]=useState("");
 const scopeKey=centerId+":"+source+":"+retry;
 useEffect(()=>{
  if(!centerId)return;
  const ctl=new AbortController();
  let session:ReturnType<typeof surfaceSession>|undefined;
  void (async()=>{
   session=surfaceSession("BO",undefined,fetch,{id:centerId,source});
   const active=session;
   // Create remains an explicit separately guarded domain command, not a generic TDD capability.
   const adapter=await bindSurface(active,{registry:new TddRegistry(),definition:{...definition,capabilities:{read:READ,edit:EDIT,history:"access.audit.view"}},provider:guestProvider()},ctl.signal);
   const list=await adapter.list(queryDefault,ctl.signal);
   if(!adapter.mutation)throw adapterError(502);
   const rows=list.rows.map(row=>{const version=list.versions[row.id];if(!version)throw adapterError(502);return {row,version};});
   const requireParent=async()=>{await active.refresh(ctl.signal);if(!["identity.parent_directory.view","student.profile.view","membership.subscription.view"].every(key=>active.context.authorize(key)))throw adapterError(403);};
   const scope={surface:"BO",centerId} as const;
   const parentContact=async(id:string)=>{await requireParent();const detail=await readScopedParentDetail(id,scope,active.transport,ctl.signal);const phone=detail.contacts.find(c=>c.type==="PHONE");if(!phone||typeof phone.maskedValue!=="string")throw new BoApiError(400,"Người giám hộ phải có số điện thoại.",null,true);await requireParent();return phone.maskedValue;};
   const port:GuestPort={
    guardians:{allowNew:()=>active.context.authorize("identity.parent.create"),options:async()=>{await requireParent();const entries=await readScopedParentDirectory(centerId,active.transport,ctl.signal);await requireParent();return entries.map(e=>({id:e.id,name:e.name??"Chưa có tên",phone:"",label:(e.name??"Chưa có tên")+" · "+(e.maskedContact??"—")+" · "+e.id.slice(-8)}));},contact:parentContact},
    update:adapter.mutation,
    read:async id=>{const v=await adapter.detail(id,ctl.signal);if(!v)return null;if(!v.version)throw adapterError(502);return {row:v.row,version:v.version};},
    create:async(input,key)=>{
     ctl.signal.throwIfAborted();
     await active.refresh(ctl.signal);
     if(!active.context.authorize(READ)||!active.context.authorize(CREATE))throw adapterError(403);
     const {guardianDraft,guardianParentId,...profile}=input;
     let committedParent:GuardianOption|null=null;
     let guardian:undefined|{parentUserId:string;relationship:NonNullable<ReturnType<typeof relationshipValue>>};
     if(profile.category==="Trẻ em"){
      await requireParent();
      const relation=relationshipValue(guardianDraft?.guardianRelation??"");if(!guardianDraft||!relation)throw new BoApiError(400,"Chọn quan hệ người giám hộ.",null,true);
      let parentId=guardianParentId;
      if(!parentId){
       if(guardianDraft.guardianSource!=="Nhập thông tin mới"||!active.context.authorize("identity.parent.create"))throw adapterError(403);
       if(inferParentContactType(guardianDraft.guardianPhone)!=="PHONE"||!guardianDraft.guardianName.trim())throw new BoApiError(400,"Nhập họ tên và điện thoại người giám hộ.",null,true);
       const parent=await createStandaloneParent(centerId,{displayName:guardianDraft.guardianName.trim(),contacts:[{identifierType:"PHONE",value:guardianDraft.guardianPhone.trim(),isPrimary:true}]},key+"-parent",active.transport);
       parentId=parent.parentUserId;
       committedParent={id:parentId,label:guardianDraft.guardianName.trim()+" · "+parentId.slice(-8),name:guardianDraft.guardianName.trim(),phone:""};
      }
      const phone=await finishGuestWithParent(committedParent,()=>parentContact(parentId!));
      if(committedParent)committedParent={...committedParent,phone};
      guardian={parentUserId:parentId,relationship:relation};
     }
     const result=await finishGuestWithParent(committedParent,()=>createGuest(centerId,{...profile,...(guardian?{guardian}:{})},key,active.transport,ctl.signal));
     // Reattest same actor, scope and view/create grant before showing the result.
     try{
      await active.refresh(ctl.signal);
      if(!active.context.authorize(READ)||!active.context.authorize(CREATE))throw adapterError(403);
      const actual=await adapter.detail(result.row.id,ctl.signal);
      if(!actual?.version)throw adapterError(502);
      return {row:actual.row,version:actual.version};
     }catch{throw Error("Guest command accepted; authoritative readback not confirmed.");}
    }
   };
   ctl.signal.throwIfAborted();
   setReady({scopeKey,adapter,rows,port,canCreate:active.context.authorize(CREATE)});
  })().catch(()=>{if(!ctl.signal.aborted){session?.dispose();setFailed(scopeKey);}});
  return ()=>{ctl.abort();session?.dispose();};
 },[centerId,source,scopeKey]);
 const available=ready?.scopeKey===scopeKey?ready:null;
 if(!available)return <>{menu("mytime-guests-menu")}{selection?.loading?<p role="status">Đang tải cơ sở…</p>:selection?.error?<p role="alert">{selection.error}</p>:!centerId?<p role="status">Chọn cơ sở để xem khách.</p>:failed===scopeKey?<><RecordState status="denied"/><button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>:<p role="status">Đang tải khách…</p>}</>;
 return <BoMyTimeGuests key={scopeKey} context={available.adapter.context} binding={available.adapter} centerLabel={selection?.centers.find(c=>c.id===centerId)?.displayName??""} initialRows={available.rows} port={available.port} canCreate={available.canCreate} canCreateNow={()=>available.adapter.context.authorize(CREATE)}/>;
}
