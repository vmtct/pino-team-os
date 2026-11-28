"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {TosVNextFrame} from "../tos-ds";
import {TosCameraReviewContent} from "./TosVNextShift";
import {verifyCameraStageClient,type CameraReviewProof} from "@/lib/pap1612-camera-stage-client";
import {createTosCameraReview,TOS_CAMERA_REVIEW_CENTER,TOS_CAMERA_REVIEW_DATE} from "@/lib/pap1612-tos-camera-fixture";
/** Synthetic presentation; the server entry owns authenticated admission. */
export function TosCameraStageReview({proof}:{proof:CameraReviewProof}){
 const query=useSearchParams();
 if(query.size!==2||query.getAll("cameraReview").length!==1||query.get("cameraReview")!=="1"||query.getAll("centerId").length!==1||query.get("centerId")!==proof.centerId)return <p role="alert">Phiên xem mẫu không còn đúng cơ sở.</p>;
 return <AdmittedTosReview key={proof.actorId+":"+proof.centerId} proof={proof}/>;
}
function AdmittedTosReview({proof}:{proof:CameraReviewProof}){
 const [status,setStatus]=useState<"pending"|"ready"|"denied">("pending");
 const [fixture]=useState(createTosCameraReview);
 useEffect(()=>{
  const controller=new AbortController();
  void verifyCameraStageClient("TOS",new URL(location.href),proof,controller.signal).then(()=>{if(!controller.signal.aborted)setStatus("ready");}).catch(()=>{if(!controller.signal.aborted)setStatus("denied");});
  return ()=>controller.abort();
 },[proof]);
 if(status==="denied")return <p role="alert">Không thể xác thực quyền xem Ca Làm mẫu.</p>;
 if(status!=="ready")return <p role="status">Đang xác thực quyền xem Ca Làm mẫu…</p>;
 return <TosVNextFrame app="shift"><TosCameraReviewContent data={fixture} localDate={TOS_CAMERA_REVIEW_DATE} centerId={TOS_CAMERA_REVIEW_CENTER} centerName="Cần Thơ · Mẫu" profileLabel="Nhân viên mẫu"/></TosVNextFrame>;
}
