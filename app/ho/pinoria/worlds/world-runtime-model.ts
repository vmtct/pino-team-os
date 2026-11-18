/** PAP-2143 / PAP-8 — runtime adapter for the approved Scene Builder. */
import type {BoRecord} from "@/lib/bo-registration";
import {createScene,saveScene,uploadSceneMedia,toUiGeometry,type CoreWorld,type CoreScene,type SceneDraftLayer} from "./world-runtime-client";
const safeAsset=/^pinoria\/world\/uploads\/[0-9a-f]{64}\.(png|gif|webm)$/;
export function assetUrl(asset:unknown):string|null{return typeof asset==="string"&&safeAsset.test(asset)?"https://assets.pinohouse.art/"+asset:null}
const noAudit={createdAt:null,updatedAt:null,createdByUser:"—",updatedByUser:"—"};
export function projectRuntimeWorld(w:CoreWorld){
 const world:BoRecord={...noAudit,id:w.id,name:w.displayName,key:w.key,worldType:w.worldType,status:w.status,description:w.descriptionText,version:w.version,sceneCount:w.scenes.length,layerCount:w.scenes.reduce((n,s)=>n+s.layers.length,0)};
 const scenes:BoRecord[]=w.scenes.map(s=>({...noAudit,id:s.id,worldId:w.id,name:s.displayName,key:s.key,status:s.status,description:s.descriptionText,canvasWidth:s.canvasWidth,canvasHeight:s.canvasHeight,baseAssetKey:s.baseAssetKey,sortOrder:s.sortOrder,version:s.version}));
 const layers:BoRecord[]=w.scenes.flatMap(s=>[
  {...noAudit,id:"background:"+s.id,sceneId:s.id,key:"background",name:"Background",kind:"BACKGROUND",assetKey:s.baseAssetKey,mediaType:"PNG",x:50,y:50,scale:100,z:0,rotation:0,anchor:"CENTER",enabled:true},
  ...s.layers.map(l=>({...noAudit,id:l.id,sceneId:s.id,key:l.key,name:l.displayName,kind:l.kind,mediaType:l.mediaType,assetKey:l.assetKey,posterAssetKey:l.posterAssetKey,mediaName:l.assetKey?.split("/").at(-1)??"",...toUiGeometry(l),z:l.zIndex+1,anchor:l.anchor,enabled:l.enabled,version:l.version}))
 ]);
 return{world,scenes,layers};
}
// Replay IDs survive manual retry of the same exact operation in one mounted World scope.
export class WorldMutationJournal{
 private readonly keys=new Map<string,string>();
 constructor(private readonly newKey:()=>string=()=>crypto.randomUUID()){}
 key(operation:string,payload:unknown){
  const signature=JSON.stringify([operation,payload]);const old=this.keys.get(signature);if(old)return old;
  // Never silently evict an ambiguous command's replay key.
  if(this.keys.size>=200)throw Error("Quá nhiều thao tác chưa đối soát. Tải lại World trước khi tiếp tục.");
  const fresh=this.newKey();this.keys.set(signature,fresh);return fresh
 }
}
function text(v:unknown){if(typeof v!=="string"||!v.trim())throw Error("Layer thiếu thông tin.");return v.trim()}
function number(v:unknown){if(typeof v!=="number"||!Number.isFinite(v))throw Error("Calibration không hợp lệ.");return v}
function draftMediaFile(row:BoRecord):File|null{
 if(typeof row.mediaData!=="string")return null;
 const m=/^data:(image\/(?:png|gif));base64,([A-Za-z0-9+/=]+)$/.exec(row.mediaData);
 if(!m||m[2]!.length>Math.ceil(8*1024*1024/3)*4)throw Error("Media không hợp lệ.");
 const bytes=Uint8Array.from(atob(m[2]!),x=>x.charCodeAt(0));
 return new File([bytes],text(row.mediaName),{type:m[1]});
}
async function digest(file:File){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),x=>x.toString(16).padStart(2,"0")).join("")}
async function upload(file:File,journal:WorldMutationJournal,fetcher:typeof fetch){
 const identity=[file.name,file.type,file.size,await digest(file)];
 return uploadSceneMedia(file,journal.key("upload",identity),fetcher);
}
export async function prepareRuntimeDraft(scene:CoreScene,rows:BoRecord[],journal:WorldMutationJournal,fetcher:typeof fetch=fetch):Promise<SceneDraftLayer[]>{
 const bg=rows.filter(l=>l.kind==="BACKGROUND");
 if(bg.length!==1||bg[0]?.id!=="background:"+scene.id||bg[0]?.assetKey!==scene.baseAssetKey)throw Error("Nền PNG của cảnh không hợp lệ.");
 const prior=new Map(scene.layers.map(l=>[l.id,l])),seen=new Set<string>(),layers=rows.filter(l=>l.kind!=="BACKGROUND");
 if(layers.length>40||layers.filter(l=>l.kind==="CHARACTER").length!==1||layers.some(l=>l.sceneId!==scene.id))throw Error("Layer không thuộc cảnh.");
 const out:SceneDraftLayer[]=[];
 for(const row of [...layers].sort((a,b)=>number(b.z)-number(a.z))){
  if(seen.has(row.id))throw Error("Layer trùng ID.");seen.add(row.id);
  const old=prior.get(row.id),g={x:number(row.x),y:number(row.y),scale:number(row.scale),rotation:number(row.rotation??0)};
  if(row.kind==="CHARACTER"){if(old?.kind!=="CHARACTER"||row.id!==scene.id)throw Error("Character không hợp lệ.");out.push({kind:"CHARACTER",id:scene.id,...g});continue}
  if(row.kind!=="MEDIA"||(old&&old.kind!=="MEDIA"))throw Error("Layer không hợp lệ.");
  // Unknown persisted-looking IDs are not interpreted as new media.
  if(!old&&!row.id.startsWith("qa-world-local-"))throw Error("Layer không thuộc cảnh.");
  const file=draftMediaFile(row),stored=file?await upload(file,journal,fetcher):null;
  const mediaType=stored?.mediaType??old?.mediaType,assetKey=stored?.objectKey??old?.assetKey;
  if((mediaType!=="PNG"&&mediaType!=="GIF"&&mediaType!=="WEBM")||!assetKey||!assetUrl(assetKey))throw Error("Media mới cần PNG/GIF hợp lệ.");
  out.push({kind:"MEDIA",id:old?.id??null,key:old?.key??text(row.key),displayName:text(row.name),mediaType,assetKey,posterAssetKey:stored?null:old?.posterAssetKey??null,enabled:old?.enabled??true,...g});
 }
 return out
}
export async function saveRuntimeScene(scene:CoreScene,rows:BoRecord[],journal:WorldMutationJournal,fetcher:typeof fetch=fetch){
 const draft=await prepareRuntimeDraft(scene,rows,journal,fetcher);
 return saveScene(scene,draft,journal.key("save-scene",[scene.id,scene.version,draft]),fetcher)
}
export async function createRuntimeScene(world:CoreWorld,name:string,background:File,journal:WorldMutationJournal,fetcher:typeof fetch=fetch){
 const title=text(name);if(background.type!=="image/png")throw Error("Nền cảnh cần PNG.");
 const base=await upload(background,journal,fetcher);if(base.mediaType!=="PNG")throw Error("Nền cảnh cần PNG.");
 // Stable key for an identical create intent, including its world version and asset.
 const intent=[world.id,world.version,title,base.objectKey],replay=journal.key("create-scene",intent);
 const key="scene-"+replay.toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,64);
 const updated=await createScene(world.id,{expectedWorldVersion:world.version,key,displayName:title,canvasWidth:1920,canvasHeight:1080,baseAssetKey:base.objectKey},replay,fetcher);
 const scene=updated.scenes.find(s=>s.key===key);if(!scene)throw Error("Cảnh vừa tạo chưa được xác minh.");
 return{world:updated,sceneId:scene.id};
}
