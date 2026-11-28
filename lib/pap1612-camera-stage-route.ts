/** PAP-1612: explicit synthetic review request, never an authorization grant. */
export type CameraReviewSurface="BO"|"TOS";
export type CameraStageEnv={APP_ENV?:string;BO_CAMERA_M1_REVIEW?:string;TOS_CAMERA_M1_REVIEW?:string};
export const CAMERA_STAGE_HOST={BO:"bo.staging.pinohouse.art",TOS:"tos.staging.pinohouse.art"} as const;
export const CAMERA_STAGE_PATH={BO:"/bo/workforce/timekeeping",TOS:"/"} as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseCameraStageReview(surface:CameraReviewSurface,url:URL,env:CameraStageEnv){
 const flag=surface==="BO"?env.BO_CAMERA_M1_REVIEW:env.TOS_CAMERA_M1_REVIEW;
 if(env.APP_ENV!=="staging"||flag!=="enabled"||url.origin!=="https://"+CAMERA_STAGE_HOST[surface]||url.pathname!==CAMERA_STAGE_PATH[surface]||url.hash||url.username||url.password)return null;
 const q=new URLSearchParams(url.searchParams);
 if(surface==="BO")for(const key of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"])q.delete(key);
 if(q.size!==2||q.getAll("cameraReview").length!==1||q.get("cameraReview")!=="1"||q.getAll("centerId").length!==1)return null;
 const centerId=q.get("centerId")??"";
 return uuid.test(centerId)?Object.freeze({surface,centerId}):null;
}
