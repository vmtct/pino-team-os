"use client";
/** PAP-2153: same synthetic presentation in admitted local and Staging review. */
import {useState} from "react";
import {AvatarDirectoryDsa} from "./AvatarDirectoryDsa";
import {avatarWorldReviewMarker,avatarWorldReviewRecord,avatarWorldReviewScope,createAvatarWorldReview} from "./avatar-world-m1-fixture";
import {SelfWorldTabContent} from "./SelfWorldTabContent";
import {AvatarWorldReviewPreview} from "./AvatarWorldReviewPreview";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
export function AvatarWorldReview({stageCenterId}:{stageCenterId?:string}){
 const [fixture]=useState(createAvatarWorldReview);
 const [state,setState]=useState(()=>fixture.read());
 const [instanceId,setInstanceId]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const content=<><p role="status" data-m1-fixture={avatarWorldReviewMarker}>M1: Mô phỏng World, không lưu vào hệ thống.</p>{message&&<p role="status">{message}</p>}<SelfWorldTabContent scope={avatarWorldReviewScope} state={state} grants={fixture.grants} status="ready" busy={false} preview={instance=><AvatarWorldReviewPreview instance={instance}/>} instanceId={instanceId} onOpen={setInstanceId} onBack={()=>setInstanceId(null)} onReload={()=>setState(fixture.read())} onConfirm={intent=>{try{setState(fixture.confirm(state,intent));setMessage("M1: Đã cập nhật mô phỏng.");}catch{setMessage("M1: Thao tác không hợp lệ.");}}}/></>;
 return <TddPreferencePolicy.Provider value="ephemeral"><AvatarDirectoryDsa review={{row:avatarWorldReviewRecord,centerId:avatarWorldReviewScope.centerId,worldContent:content,stageCenterId}}/></TddPreferencePolicy.Provider>;
}
