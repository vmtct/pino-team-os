/** PAP-2337 / PNR-APP-HUB — isolated presentation data; never opens a live session. */
import type {AuthorizationContext} from "@/lib/workspace-schema";
import {bindNativeDraft} from "./native-draft-binding";
import {CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import type {NativeDraftSession} from "./native-draft-session";
import type {PostProgramKey,PersonChoice} from "./data-port";
const CENTER="CENTER-MOCK-001";
const people:Record<PostProgramKey,readonly PersonChoice[]>={AFTERSCHOOL:[{id:"PERSON-MOCK-001",label:"Minh Khang · Học viên · 8 tuổi · •••• 1234"}],MYTIME:[{id:"PERSON-MOCK-002",label:"An Nhiên · Khách MyTime · 12 tuổi · •••• 5678"}]};
const publisher=(program:PostProgramKey)=>program==="AFTERSCHOOL"?"PINO Afterschool":"MyTime by PINO";
function row(id:string,personId:string,program:PostProgramKey,caption:string):CoreDraftRow {
 const person=people[program].find(p=>p.id===personId);if(!person)throw new CoreDraftRequestError(404,"create");
 return {id,studentId:null,personId,personName:person.label,programKey:program,centerId:CENTER,version:1,name:person.label,program:publisher(program),author:publisher(program),caption,status:"Nháp",center:"PINO Cần Thơ (mẫu)",source:"Chưa có",mediaCount:0,commentCount:0,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
}
type NativeController=NativeDraftSession["controller"];
export type DraftRuntimeSession=Pick<NativeDraftSession,"registry"|"schema"|"mutation"|"context"|"userId"|"canCreate"|"canEditMedia"|"mediaController"|"personChoices">&{controller:Pick<NativeController,"centerId"|"list"|"detail"|"createDraft"|"editCaption"|"hasUnresolvedCommand">};
export function createPostPreviewSession():DraftRuntimeSession&{dispose:()=>void} {
 let closed=false,sequence=1;
 const rows=new Map<string,CoreDraftRow>([["POST-MOCK-001",row("POST-MOCK-001","PERSON-MOCK-001","AFTERSCHOOL","Từng nốt nhạc nhỏ là một bước tiến lớn.")]]);
 const guard=(signal:AbortSignal)=>{signal.throwIfAborted();if(closed)throw new CoreDraftRequestError(403);};
 const read=(id:string)=>{const value=rows.get(id);if(!value)throw new CoreDraftRequestError(404);return value;};
 // These capabilities drive only the synthetic presentation renderer. No transport, principal, or Core session exists.
 const context:AuthorizationContext={surface:"BO",centerId:CENTER,authorize:permission=>!closed&&["piner.post.view","piner.post.create","piner.post.edit"].includes(permission)};
 const controller:DraftRuntimeSession["controller"]={
  centerId:CENTER,
  async list(signal,beforeId){guard(signal);return {rows:[...rows.values()].filter(r=>!beforeId||r.id<beforeId).sort((a,b)=>b.id.localeCompare(a.id)),nextBeforeId:null};},
  async detail(id,signal){guard(signal);return read(id);},
  async createDraft(personId,program,caption,signal){guard(signal);const created=row("POST-MOCK-"+String(++sequence).padStart(3,"0"),personId,program,caption);rows.set(created.id,created);return created;},
  async editCaption(id,version,caption,signal){guard(signal);const prior=read(id);if(prior.version!==version||prior.status!=="Nháp")throw new CoreDraftRequestError(409);const next={...prior,caption,version:version+1};rows.set(id,next);return next;},
  hasUnresolvedCommand:()=>false
 };
 const binding=bindNativeDraft(controller,context);
 type MediaController=ReturnType<NativeDraftSession["mediaController"]>;
 type Listing=Awaited<ReturnType<MediaController["list"]>>;
 const media=new Map<string,MediaController>();
 function mediaController(id:string):MediaController {
  read(id);const previous=media.get(id);if(previous)return previous;
  let seq=0,selected:string|undefined;const files=new Map<string,{file:Blob;version:number}>();
  const list=async(signal:AbortSignal):Promise<Listing>=>{guard(signal);const post=read(id);return {postVersion:post.version,mediaCount:post.mediaCount,attachments:[...files].map(([id,{file,version}])=>({id,state:"READY",mimeType:file.type as "image/png"|"image/jpeg"|"image/webp",byteSize:file.size,version:1,postVersion:version,expiresAt:"2099-01-01T00:00:00Z"}))};};
  const bump=()=>{const post=read(id);const next={...post,version:post.version+1,mediaCount:files.size,source:files.size?"Upload trực tiếp":"Chưa có"};rows.set(id,next);return next;};
  const result:MediaController={
   list,async upload(file,signal){guard(signal);if(files.size>=5||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024||file.size<1)throw Error("Ảnh không hợp lệ.");files.set("MEDIA-MOCK-"+(++seq),{file,version:read(id).version+1});bump();return list(signal);},
   async remove(key,signal){guard(signal);if(!files.delete(key))throw new CoreDraftRequestError(404);bump();return list(signal);},
   retry:list,hasPending:()=>false,
   async openPreview(key,signal){guard(signal);const value=files.get(key);if(!value)throw new CoreDraftRequestError(404);if(selected)URL.revokeObjectURL(selected);selected=URL.createObjectURL(value.file);return {id:key,url:selected};},
   closePreview(){if(selected)URL.revokeObjectURL(selected);selected=undefined;},dispose(){this.closePreview();files.clear();}
  };
  media.set(id,result);return result;
 }
 return {...binding,controller,userId:"synthetic-presentation-only",canEditMedia:()=>!closed,mediaController,async personChoices(program,signal){guard(signal);return people[program];},dispose(){closed=true;binding.unbind();for(const item of media.values())item.dispose();media.clear();rows.clear();}};
}
