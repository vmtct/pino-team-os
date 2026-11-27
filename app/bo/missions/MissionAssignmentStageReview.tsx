"use client";
/** PAP-2425: unmounted client composition; caller must supply actual server admission. */
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import type {AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import type {CenterSource} from "@/lib/workspace-adapters/session";
import type {ExpandedAssignmentFields} from "./assignment-expanded-schema";
import {MissionAssignmentM1Content} from "./MissionAssignmentM1";
import {verifyAssignmentStageReview} from "./assignment-stage-admission";
import {createAssignmentStageNavigation} from "./assignment-stage-navigation";
type Proof={actorId:string;centerId:string;centerSource:CenterSource};
type Ready={key:string;navigation:AdapterNavigation<ExpandedAssignmentFields>};
export function MissionAssignmentStageReview({admission}:{admission:Proof}){
 const center=useBoCenterSelection(),params=useSearchParams();
 const candidate=params.get("centerId");
 const allowed=!!center&&!center.loading&&!center.error&&center.selected===admission.centerId&&candidate===admission.centerId&&center.source===admission.centerSource;
 const key=admission.actorId+":"+admission.centerId+":"+admission.centerSource;
 const [ready,setReady]=useState<Ready|null>(null),[failed,setFailed]=useState<string|null>(null);
 useEffect(()=>{
  if(!allowed)return;
  const ctl=new AbortController();
  void verifyAssignmentStageReview({url:new URL(location.href),expectedActorId:admission.actorId,centerSource:admission.centerSource,signal:ctl.signal}).then(proof=>{
   if(ctl.signal.aborted)return;
   if(proof.centerId!==admission.centerId)throw Error("Mission review scope changed");
   const navigation=createAssignmentStageNavigation(admission.centerId,()=>{setReady(null);setFailed(key);});
   setReady({key,navigation});setFailed(null);
  }).catch(()=>{if(!ctl.signal.aborted){setReady(null);setFailed(key);}});
  return()=>ctl.abort();
 },[allowed,key,admission.actorId,admission.centerId,admission.centerSource]);
 if(!allowed||failed===key)return <p role="alert">Không thể xác minh quyền xem Nhiệm vụ mẫu tại cơ sở đã chọn.</p>;
 if(ready?.key!==key)return <p role="status">Đang xác thực quyền xem Nhiệm vụ mẫu…</p>;
 return <TddPreferencePolicy.Provider value="ephemeral"><MissionAssignmentM1Content key={key} navigation={ready.navigation}/></TddPreferencePolicy.Provider>;
}
