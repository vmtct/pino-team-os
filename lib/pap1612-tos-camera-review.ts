/** Isolated HTTP review only; never supplies an authenticated camera or attendance receipt. */
export const TOS_CAMERA_REVIEW_ROUTE="/tos";
export type CameraReviewStep="framing"|"preview"|"confirmed";
export type CameraReviewAction="capture"|"retake"|"confirm";
export function isTosCameraLocalReview(origin:string,opaqueOrigin:string,path:string,search:string,hash:string){
 return ["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800","http://192.168.1.6:8800"].includes(origin)&&opaqueOrigin==="null"&&path===TOS_CAMERA_REVIEW_ROUTE&&!search&&!hash;
}
export function cameraReviewTransition(step:CameraReviewStep,action:CameraReviewAction):CameraReviewStep{
 if(step==="framing"&&action==="capture")return "preview";
 if(step==="preview"&&action==="retake")return "framing";
 if(step==="preview"&&action==="confirm")return "confirmed";
 return step;
}