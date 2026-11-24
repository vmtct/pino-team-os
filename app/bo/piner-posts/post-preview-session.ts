/** PAP-2337 / PNR-APP-HUB — isolated presentation data; never opens a live session. */
import type {AuthorizationContext} from "@/lib/workspace-schema";
import {bindNativeDraft} from "./native-draft-binding";
import {CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import type {NativeDraftSession} from "./native-draft-session";
import type {PostProgramKey,PersonChoice} from "./data-port";
const CENTER="CENTER-MOCK-001";
const people:Record<PostProgramKey,readonly PersonChoice[]>={AFTERSCHOOL:[{id:"PERSON-MOCK-001",label:"Minh Khang · Học viên · 8 tuổi · •••• 1234"}],MYTIME:[{id:"PERSON-MOCK-002",label:"An Nhiên · Khách MyTime · 12 tuổi · •••• 5678"}]};
const publisher=(program:PostProgramKey)=>program==="AFTERSCHOOL"?"PINO Afterschool":"MyTime by PINO";
const SAMPLE_PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=";
function sampleImage(tone:string):string {
 if(typeof document==="undefined")return SAMPLE_PNG;
 const canvas=document.createElement("canvas");canvas.width=640;canvas.height=480;
 const ctx=canvas.getContext("2d");if(!ctx)return SAMPLE_PNG;
 ctx.fillStyle="#f3e8d7";ctx.fillRect(0,0,640,480);
 ctx.fillStyle=tone;ctx.beginPath();ctx.arc(320,208,136,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#d6a76c";ctx.beginPath();ctx.moveTo(62,380);ctx.lineTo(216,128);ctx.lineTo(364,380);ctx.lineTo(480,200);ctx.lineTo(580,380);ctx.closePath();ctx.fill();
 ctx.fillStyle="#4c3429";ctx.font="22px sans-serif";ctx.textAlign="center";ctx.fillText("PINO · Ảnh mẫu",320,430);return canvas.toDataURL("image/png");
}
function blobOf(src:string){return new Blob([Uint8Array.from(atob(src.split(",")[1]),c=>c.charCodeAt(0))],{type:"image/png"});}
function dataUrl(file:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(Error("Ảnh không hợp lệ."));reader.onerror=reject;reader.readAsDataURL(file);});}
function row(id:string,personId:string,program:PostProgramKey,caption:string):CoreDraftRow {
 const person=people[program].find(p=>p.id===personId);if(!person)throw new CoreDraftRequestError(404,"create");
 return {id,studentId:null,personId,personName:person.label,programKey:program,centerId:CENTER,version:1,name:person.label,program:publisher(program),author:publisher(program),caption,status:"Nháp",center:"PINO Cần Thơ (mẫu)",source:"Chưa có",mediaCount:0,commentCount:0,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
}
type NativeController=NativeDraftSession["controller"];
type MediaController=ReturnType<NativeDraftSession["mediaController"]>;
type Listing=Awaited<ReturnType<MediaController["list"]>>;
export type ComposerSnapshot={diaries:readonly {id:string;label:string;src:string;selected:boolean;used:boolean;reason?:string}[];media:readonly {id:string;src:string;diaryId?:string;retouched:boolean}[];sourceDiary:string};
type ComposerPort={snapshot:()=>ComposerSnapshot;toggle:(diaryId:string,signal:AbortSignal)=>Promise<Listing>;reorder:(id:string,offset:number,signal:AbortSignal)=>Promise<Listing>;source:(id:string)=>void};
export type DraftRuntimeSession=Pick<NativeDraftSession,"registry"|"schema"|"mutation"|"context"|"userId"|"canCreate"|"canEditMedia"|"mediaController"|"personChoices">&{controller:Pick<NativeController,"centerId"|"list"|"detail"|"createDraft"|"editCaption"|"hasUnresolvedCommand">;composer?:(id:string)=>ComposerPort;submitPreview?:(id:string,version:number,signal:AbortSignal)=>Promise<CoreDraftRow>};
type MediaItem={id:string;file:Blob;version:number;src:string;diaryId?:string;retouched:boolean};
export function createPostPreviewSession():DraftRuntimeSession&{dispose:()=>void} {
 let closed=false,sequence=1,mediaSequence=1;
 const diaries=[{id:"DIARY-MOCK-001",label:"16/11 · Piano",src:sampleImage("#87a4aa")},{id:"DIARY-MOCK-002",label:"19/11 · Piano",src:sampleImage("#c27e61")},{id:"DIARY-MOCK-003",label:"20/11 · Piano",src:sampleImage("#788b68")}];
 const claims=new Map<string,string>([[diaries[0].id,"POST-MOCK-001"],[diaries[2].id,"POST-MOCK-999"]]);
 const initial=row("POST-MOCK-001","PERSON-MOCK-001","AFTERSCHOOL","Từng nốt nhạc nhỏ là một bước tiến lớn.");
 const rows=new Map<string,CoreDraftRow>([[initial.id,{...initial,mediaCount:1,source:"Diary"}]]);
 const mediaFiles=new Map<string,MediaItem[]>([[initial.id,[{id:"MEDIA-MOCK-001",file:blobOf(diaries[0].src),version:1,src:diaries[0].src,diaryId:diaries[0].id,retouched:false}]]]);
 const sources=new Map<string,string>([[initial.id,diaries[0].id]]);
 const guard=(signal:AbortSignal)=>{signal.throwIfAborted();if(closed)throw new CoreDraftRequestError(403);};
 const read=(id:string)=>{const value=rows.get(id);if(!value)throw new CoreDraftRequestError(404);return value;};
 const writable=(id:string,signal:AbortSignal)=>{guard(signal);const post=read(id);if(post.status!=="Nháp")throw new CoreDraftRequestError(409);return post;};
 const files=(id:string)=>mediaFiles.get(id)??[];
 const bump=(id:string,next:MediaItem[])=>{const post=read(id);mediaFiles.set(id,next);const updated={...post,version:post.version+1,mediaCount:next.length,source:next.some(m=>m.diaryId)?"Diary":next.length?"Upload trực tiếp":"Chưa có"};rows.set(id,updated);return updated;};
 const newId=()=> "MEDIA-MOCK-"+String(++mediaSequence).padStart(3,"0");
 // Presentation-only capability discriminator. No transport, principal, or Core session.
 const context:AuthorizationContext={surface:"BO",centerId:CENTER,authorize:permission=>!closed&&["piner.post.view","piner.post.create","piner.post.edit"].includes(permission)};
 const controller:DraftRuntimeSession["controller"]={
  centerId:CENTER,
  async list(signal,beforeId){guard(signal);return {rows:[...rows.values()].filter(r=>!beforeId||r.id<beforeId).sort((a,b)=>b.id.localeCompare(a.id)),nextBeforeId:null};},
  async detail(id,signal){guard(signal);return read(id);},
  async createDraft(personId,program,caption,signal){guard(signal);const created=row("POST-MOCK-"+String(++sequence).padStart(3,"0"),personId,program,caption);rows.set(created.id,created);return created;},
  async editCaption(id,version,caption,signal){const prior=writable(id,signal);if(prior.version!==version)throw new CoreDraftRequestError(409);const next={...prior,caption,version:version+1};rows.set(id,next);return next;},
  hasUnresolvedCommand:()=>false
 };
 const binding=bindNativeDraft(controller,context);
 const media=new Map<string,MediaController>();
 const listing=async(id:string,signal:AbortSignal):Promise<Listing>=>{guard(signal);const post=read(id);return {postVersion:post.version,mediaCount:post.mediaCount,attachments:files(id).map(({id,file,version})=>({id,state:"READY",mimeType:file.type as "image/png"|"image/jpeg"|"image/webp",byteSize:file.size,version:1,postVersion:version,expiresAt:"2099-01-01T00:00:00Z"}))};};
 function mediaController(id:string):MediaController {
  read(id);const previous=media.get(id);if(previous)return previous;
  const list=(signal:AbortSignal)=>listing(id,signal);
  const result:MediaController={
   list,async upload(file,signal){writable(id,signal);if(files(id).length>=5||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024||file.size<1)throw Error("Ảnh không hợp lệ.");const src=await dataUrl(file);writable(id,signal);if(files(id).length>=5)throw Error("Tối đa 5 ảnh.");const diaryId=sources.get(id);bump(id,[...files(id),{id:newId(),file,version:read(id).version+1,src,diaryId,retouched:Boolean(diaryId)}]);return list(signal);},
   async remove(key,signal){writable(id,signal);if(!files(id).some(m=>m.id===key))throw new CoreDraftRequestError(404);bump(id,files(id).filter(m=>m.id!==key));return list(signal);},
   retry:list,hasPending:()=>false,
   async openPreview(key,signal){guard(signal);const value=files(id).find(m=>m.id===key);if(!value)throw new CoreDraftRequestError(404);return {id:key,url:value.src};},
   closePreview(){},dispose(){}
  };
  media.set(id,result);return result;
 }
 const composer=(id:string):ComposerPort=>({
  snapshot(){read(id);return {diaries:diaries.map(d=>({...d,selected:claims.get(d.id)===id,used:Boolean(claims.get(d.id)&&claims.get(d.id)!==id),reason:claims.get(d.id)&&claims.get(d.id)!==id?"Đã sử dụng trong Post "+claims.get(d.id):undefined})),media:files(id).map(({id,src,diaryId,retouched})=>({id,src,diaryId,retouched})),sourceDiary:sources.get(id)??""};},
  async toggle(diaryId,signal){const prior=writable(id,signal),d=diaries.find(v=>v.id===diaryId);if(!d)throw new CoreDraftRequestError(404);const claim=claims.get(diaryId);if(claim&&claim!==id)throw new CoreDraftRequestError(409);
   if(claim===id){claims.delete(diaryId);if(sources.get(id)===diaryId)sources.delete(id);bump(id,files(id).filter(m=>m.diaryId!==diaryId));}
   else{if(files(id).length>=5)throw Error("Tối đa 5 ảnh.");claims.set(diaryId,id);sources.set(id,diaryId);bump(id,[...files(id),{id:newId(),file:blobOf(d.src),src:d.src,version:prior.version+1,diaryId,retouched:false}]);}return listing(id,signal);},
  async reorder(mediaId,offset,signal){writable(id,signal);const next=[...files(id)],i=next.findIndex(m=>m.id===mediaId),j=i+offset;if(i<0||j<0||j>=next.length||Math.abs(offset)!==1)throw Error("Thứ tự không hợp lệ.");next.splice(j,0,next.splice(i,1)[0]);bump(id,next);return listing(id,signal);},
  source(diaryId){if(closed||read(id).status!=="Nháp")return;if(!diaryId)sources.delete(id);else if(claims.get(diaryId)===id)sources.set(id,diaryId);}
 });
 return {...binding,controller,userId:"synthetic-presentation-only",canEditMedia:()=>!closed,mediaController,composer,
  async submitPreview(id,version,signal){const prior=writable(id,signal);if(prior.version!==version||!prior.caption.trim()||!prior.mediaCount)throw new CoreDraftRequestError(409);const next={...prior,status:"Chờ duyệt",version:prior.version+1};rows.set(id,next);return next;},
  async personChoices(program,signal){guard(signal);return people[program];},dispose(){closed=true;binding.unbind();for(const item of media.values())item.dispose();media.clear();rows.clear();mediaFiles.clear();claims.clear();sources.clear();}};
}
