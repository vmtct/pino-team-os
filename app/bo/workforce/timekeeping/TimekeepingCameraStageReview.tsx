"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import {verifyCameraStageClient,type CameraReviewProof} from "@/lib/pap1612-camera-stage-client";
import {createTimekeepingCameraReview} from "./timekeeping-camera-local-review";
import {TimekeepingReviewContent} from "./TimekeepingView";
export function TimekeepingCameraStageReview({proof}:{proof:CameraReviewProof}){
 const center=useBoCenterSelection(),query=useSearchParams();
 const allowed=!!center&&!center.loading&&!center.error&&center.selected===proof.centerId&&query.get("centerId")===proof.centerId&&query.get("cameraReview")==="1";
 if(center?.loading)return <p role="status">Đang xác thực cơ sở…</p>;
 if(!allowed)return <p role="alert">Phiên xem mẫu không còn đúng cơ sở. Mở lại liên kết review được cấp quyền.</p>;
 return <AdmittedReview key={proof.actorId+":"+proof.centerId} proof={proof}/>;
}
function AdmittedReview({proof}:{proof:CameraReviewProof}){
 const [state,setState]=useState<"pending"|"ready"|"denied">("pending");
 const [review]=useState(createTimekeepingCameraReview);
 useEffect(()=>{
  const controller=new AbortController();
  void verifyCameraStageClient("BO",new URL(location.href),proof,controller.signal).then(()=>{if(!controller.signal.aborted)setState("ready");}).catch(()=>{if(!controller.signal.aborted)setState("denied");});
  return ()=>controller.abort();
 },[proof]);
 if(state==="denied")return <p role="alert">Không thể xác thực quyền xem chấm công mẫu.</p>;
 if(state!=="ready")return <p role="status">Đang xác thực quyền xem chấm công mẫu…</p>;
 return <TimekeepingReviewContent review={review}/>;
}
