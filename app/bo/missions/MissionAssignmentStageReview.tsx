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
import {ASSIGNMENT_STAGE_ORIGIN} from "./assignment-stage-route";
import {ASSIGNMENT_M1_ROUTE} from "./assignment-m1-fixture";
import {assignmentUuid} from "@/lib/bo-mission-assignments";
import {createAssignmentStageNavigation} from "./assignment-stage-navigation";
type Proof={actorId:string;centerId:string;centerSource:CenterSource};
type Ready={key:string;navigation:AdapterNavigation<ExpandedAssignmentFields>};
export function MissionAssignmentStageReview({admission}:{admission:Proof}){
 const center=useBoCenterSelection(),params=useSearchParams();
 const candidate=params.get("centerId");
 const allowed=!!center&&!center.loading&&!center.error&&center.selected===admission.centerId&&candidate===admission.centerId&&center.source===admission.centerSource;
 const key=admission.actorId+":"+admission.centerId+":"+admission.centerSource;
 if(!allowed)return <p role="alert">Không thể xác minh quyền xem Nhiệm vụ mẫu tại cơ sở đã chọn.</p>;
 return <AdmittedAssignmentStageReview key={key} admission={admission} scopeKey={key}/>;
}
/** Eligibility loss unmounts this child, including its proof and synthetic navigation state. */
function AdmittedAssignmentStageReview({admission,scopeKey:key}:{admission:Proof;scopeKey:string}){
 const [ready,setReady]=useState<Ready|null>(null),[failed,setFailed]=useState<string|null>(null);
 useEffect(()=>{
  const ctl=new AbortController();
  void verifyAssignmentStageReview({url:new URL(location.href),expectedActorId:admission.actorId,centerSource:admission.centerSource,signal:ctl.signal}).then(proof=>{
   if(ctl.signal.aborted)return;
   if(proof.centerId!==admission.centerId)throw Error("Mission review scope changed");
   const navigation=createAssignmentStageNavigation(admission.centerId,()=>{setReady(null);setFailed(key);});
   setReady({key,navigation});setFailed(null);
  }).catch(()=>{if(!ctl.signal.aborted){setReady(null);setFailed(key);}});
  return()=>ctl.abort();
 },[key,admission.actorId,admission.centerId,admission.centerSource]);
 if(failed===key)return <p role="alert">Không thể xác minh quyền xem Nhiệm vụ mẫu tại cơ sở đã chọn.</p>;
 if(ready?.key!==key)return <p role="status">Đang xác thực quyền xem Nhiệm vụ mẫu…</p>;
 return <TddPreferencePolicy.Provider value="ephemeral"><MissionAssignmentM1Content key={key} navigation={ready.navigation}/></TddPreferencePolicy.Provider>;
}

/** Reenter the canonical server route on Center selection; never fabricate admission locally. */
export function MissionAssignmentStageEntry({expectedActorId,admission}:{expectedActorId:string;admission:Proof|null}){
 const center=useBoCenterSelection(),params=useSearchParams();
 const candidate=params.get("centerId");
 const selected=(!center||center.loading||center.error)?"":center.selected;
 const actorMatches=admission===null||admission.actorId===expectedActorId;
 const scopeMatches=!!admission&&actorMatches&&admission.centerId===selected&&candidate===selected;
 useEffect(()=>{
  if(!selected||!assignmentUuid.test(selected)||!actorMatches||scopeMatches||(candidate!==null&&candidate!==selected))return;
  const current=new URL(location.href);
  if(current.origin!==ASSIGNMENT_STAGE_ORIGIN||current.pathname!==ASSIGNMENT_M1_ROUTE||current.searchParams.getAll("centerId").length>1||current.searchParams.get("centerId")!==candidate)return;
  // A Center change starts at the table; stale Drawer/Detail state cannot follow it.
  location.replace(ASSIGNMENT_M1_ROUTE+"?"+new URLSearchParams({centerId:selected}).toString());
 },[selected,candidate,actorMatches,scopeMatches]);
 if(!center)return <p role="alert">Không tìm thấy Center context của BO.</p>;
 if(center.loading)return <p role="status">Đang xác thực cơ sở được cấp quyền…</p>;
 if(center.error)return <p role="alert">{center.error}</p>;
 if(!selected)return <p role="status">Chọn trung tâm tại góc trên trái để xem Nhiệm vụ mẫu.</p>;
 if(!actorMatches)return <p role="alert">Không thể xác minh quyền xem Nhiệm vụ mẫu.</p>;
 if(!scopeMatches||!admission)return <p role="status">Đang xác thực quyền xem Nhiệm vụ mẫu…</p>;
 return <MissionAssignmentStageReview admission={admission}/>;
}
