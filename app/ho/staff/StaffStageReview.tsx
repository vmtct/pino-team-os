"use client";
/** PAP-2423: review-only UI after real server admission and client recheck. */
import {useEffect,useState} from "react";
import {createHoStaffReviewController,HoStaffReviewContent,type HoStaffReviewController} from "./StaffReviewContent";
import {verifyStaffStageReview} from "./staff-stage-review-client";
import {STAFF_REVIEW_QUERY,staffHoStageSearch} from "./staff-stage-review-route";
import type {StaffStageProof} from "./staff-stage-review-admission.server";
export function HoStaffStageReview({proof}:{proof:Extract<StaffStageProof,{surface:"HO"}>}){
 const [ready,setReady]=useState<{actorId:string;controller:HoStaffReviewController}|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const ctl=new AbortController();const actorId=proof.actorId;
  const check=async()=>{try{await verifyStaffStageReview({url:new URL(location.href),proof:{surface:"HO",actorId},signal:ctl.signal});if(!ctl.signal.aborted)setReady(prev=>prev?.actorId===actorId?prev:{actorId,controller:createHoStaffReviewController({readParams:()=>{const q=new URLSearchParams(location.search);q.delete(STAFF_REVIEW_QUERY);return q;},routeSearch:staffHoStageSearch})});}catch{if(!ctl.signal.aborted){setReady(null);setFailed(true);}}};
  void check();const onFocus=()=>{void check();};window.addEventListener("focus",onFocus);return()=>{ctl.abort();window.removeEventListener("focus",onFocus);};
 },[proof.actorId]);
 if(failed)return <p role="alert">Staff review admission unavailable.</p>;
 if(ready?.actorId!==proof.actorId)return <p role="status">Verifying Staff review admission...</p>;
 return <div data-staff-stage-review="ho"><HoStaffReviewContent controller={ready.controller}/></div>;
}
