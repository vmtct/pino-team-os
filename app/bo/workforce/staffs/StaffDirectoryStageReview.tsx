"use client";
/** PAP-2411: authenticated Center-bound synthetic Staff directory review. */
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {createBoStaffReviewController,BoStaffReviewContent,type BoStaffReviewController} from "./StaffDirectoryReviewContent";
import {verifyStaffStageReview} from "@/app/ho/staff/staff-stage-review-client";
import {STAFF_BO_REVIEW_ORIGIN,STAFF_REVIEW_QUERY,staffStageReviewUrl} from "@/app/ho/staff/staff-stage-review-route";
import type {StaffStageProof} from "@/app/ho/staff/staff-stage-review-admission.server";
type Proof=Extract<StaffStageProof,{surface:"BO"}>;
function AdmittedBoStaffReview({proof,view}:{proof:Proof;view:string}){
 const [ready,setReady]=useState<BoStaffReviewController|null>(null),[failed,setFailed]=useState(false);
 const {actorId,centerId,centerSource}=proof;
 useEffect(()=>{const ctl=new AbortController();
  const check=async()=>{try{await verifyStaffStageReview({url:new URL(location.href),proof:{surface:"BO",actorId,centerId,centerSource},signal:ctl.signal});if(!ctl.signal.aborted)setReady(prev=>prev??createBoStaffReviewController(centerId));}catch{if(!ctl.signal.aborted){setReady(null);setFailed(true);}}};
  void check();const onFocus=()=>{void check();};window.addEventListener("focus",onFocus);return()=>{ctl.abort();window.removeEventListener("focus",onFocus);};
 },[actorId,centerId,centerSource]);
 if(failed)return <p role="alert">Staff review admission unavailable.</p>;
 if(!ready)return <p role="status">Verifying Staff review admission...</p>;
 return <div data-staff-stage-review="bo"><BoStaffReviewContent controller={ready} view={view}/></div>;
}
export function BoStaffDirectoryStageEntry({expectedActorId,proof}:{expectedActorId:string;proof:Proof|null}){
 const center=useBoCenterSelection(),params=useSearchParams(),candidate=params.get("centerId");
 const selected=center&&!center.loading&&!center.error?center.selected:"";
 const actorMatches=!proof||proof.actorId===expectedActorId;
 const scopeMatches=!!proof&&actorMatches&&proof.centerId===selected&&candidate===selected&&center?.source===proof.centerSource;
 useEffect(()=>{if(!selected||!actorMatches||scopeMatches||!center?.centers.some(c=>c.id===selected))return;
  const current=new URL(location.href);if(current.origin!==STAFF_BO_REVIEW_ORIGIN||current.pathname!=="/bo/workforce/staffs"||current.searchParams.getAll(STAFF_REVIEW_QUERY).length!==1||current.searchParams.get(STAFF_REVIEW_QUERY)!=="1")return;
  if(candidate!==null&&candidate!==selected)return;
  const target=staffStageReviewUrl("BO",new URLSearchParams({[STAFF_REVIEW_QUERY]:"1",centerId:selected}));if(target)location.replace(target.pathname+target.search);
 },[selected,candidate,actorMatches,scopeMatches,center?.centers]);
 if(!center||center.error||!actorMatches)return <p role="alert">Staff review Center unavailable.</p>;
 if(center.loading||!selected||!scopeMatches||!proof)return <p role="status">Select and verify an authorized Center.</p>;
 return <AdmittedBoStaffReview key={proof.actorId+":"+proof.centerId+":"+proof.centerSource} proof={proof} view={params.get("view")??"all"}/>;
}
