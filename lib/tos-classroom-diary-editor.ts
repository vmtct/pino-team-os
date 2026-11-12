/** PAP-1928: existing Diary writes stay on canonical Core commands. */
import {createV18bApiTransport,type V18bPathDiary} from "./tos-classroom-v18b-api";
import type {Diary,Evidence} from "./tos-classroom-v4-view-model";

async function key(kind:string,value:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return "pap1928-"+kind+"-"+Array.from(digest,x=>x.toString(16).padStart(2,"0")).join("");
}

export async function saveExistingClassroomDiary(input:{
 centerId:string;runningClassId:string;diary:Diary;kind:"draft"|"close";
 interest:number|null;notes:string;difficulty:string;evidence:Evidence[];
}):Promise<Diary>{
 const {centerId,runningClassId,diary,kind,interest,notes,difficulty}=input;
 const api=createV18bApiTransport(true);
 const check=(source:V18bPathDiary)=>{
  if(source.id!==diary.id||source.centerId!==centerId||source.runningClassId!==runningClassId||
   source.teachingContextKey!==diary.teachingContextKey||source.studentId!==diary.studentId)
   throw new Error("Diary readback scope mismatch");
 };
 const current=await api.diary(diary.id,centerId);
 check(current);
 if(current.status!=="REGISTERED"||current.version!==diary.version)
  throw new Error("Diary version changed");
 const fields={centerId,expectedVersion:diary.version,interest,notes,difficulty};
 const idempotencyKey=await key(kind,[diary.id,fields]);
 if(kind==="close"){
  if(interest===null)throw new Error("Diary interest required");
  for(const item of input.evidence){
   const base64=item.kind==="image"?item.preview?.match(/^data:image\/jpeg;base64,(.+)$/)?.[1]:undefined;
   if(!base64)continue;
   await api.uploadEvidence(diary.id,{centerId,mimeType:"image/jpeg",base64},
    await key("evidence",[diary.id,base64]));
  }
  await api.close(diary.id,{...fields,interest},idempotencyKey);
 }else await api.saveDraft(diary.id,fields,idempotencyKey);
 const saved=await api.diary(diary.id,centerId);
 check(saved);
 if(saved.version!==diary.version+1||saved.status!==(kind==="close"?"CLOSED":"REGISTERED"))
  throw new Error("Diary write not verified");
 return {...diary,status:saved.status,version:saved.version,interest:saved.interest,notes:saved.notes??"",
  difficulty:saved.difficulty??undefined,draftSavedAt:saved.draftSavedAt??undefined,
  closedAt:saved.closedAt??undefined};
}
