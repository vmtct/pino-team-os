/** PAP-2143 / PAP-8: authoritative HO World API; no fixture state or automatic mutation retry. */
const root="/api/ho/pinoria/worlds",uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const asset=/^pinoria\/world\/uploads\/[0-9a-f]{64}\.(png|gif|webm)$/;
const fail=():never=>{throw Error("Không xác minh được dữ liệu World từ Core.")};
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))return fail();return v as Record<string,unknown>}
function str(v:unknown):string{if(typeof v!=="string")return fail();return v}
function id(v:unknown):string{const s=str(v);if(!uuid.test(s))return fail();return s}
function num(v:unknown):number{if(typeof v!=="number"||!Number.isFinite(v))return fail();return v}
function ver(v:unknown):number{const n=num(v);if(!Number.isSafeInteger(n)||n<1)return fail();return n}
function list(v:unknown):unknown[]{if(!Array.isArray(v))return fail();return v}
function key(v:unknown,ext:string):string{const s=str(v);if(!asset.test(s)||!s.endsWith("."+ext))return fail();return s}
type Kind="CHARACTER"|"MEDIA";type Media="PNG"|"GIF"|"WEBM";
export type CoreLayer={id:string;key:string;displayName:string;kind:Kind;version:number;mediaType:Media|null;assetKey:string|null;posterAssetKey:string|null;positionX:number;positionY:number;scale:number;rotationDegrees:number;zIndex:number;anchor:"CENTER"|"BOTTOM_CENTER";enabled:boolean};
export type CoreScene={id:string;worldId:string;key:string;displayName:string;descriptionText:string;version:number;canvasWidth:number;canvasHeight:number;baseAssetKey:string;sortOrder:number;status:"ACTIVE"|"DISABLED";layers:CoreLayer[]};
export type CoreWorld={createdAt?:string|null;updatedAt?:string|null;createdByUser?:string|null;updatedByUser?:string|null;id:string;key:string;displayName:string;descriptionText:string;version:number;worldType:"CORE"|"SUMMER"|"SPECIAL"|"OTHER";status:"DRAFT"|"ACTIVE"|"ARCHIVED";scenes:CoreScene[]};
function layer(v:unknown,sceneId:string):CoreLayer{
 const o=obj(v),kind=o.kind,media=o.mediaType,anchor=o.anchor,lid=id(o.id);
 if(kind!=="CHARACTER"&&kind!=="MEDIA")return fail();
 if(anchor!=="CENTER"&&anchor!=="BOTTOM_CENTER")return fail();
 if(typeof o.enabled!=="boolean")return fail();
 if(kind==="CHARACTER"&&(lid!==sceneId||o.key!=="character"||anchor!=="BOTTOM_CENTER"||!o.enabled||media!==null||o.assetKey!==null||o.posterAssetKey!==null))return fail();
 if(kind==="MEDIA"&&(lid===sceneId||(media!=="PNG"&&media!=="GIF"&&media!=="WEBM")))return fail();
 const meta=obj(o.metadata??{}),scale=num(o.scale),rotationDegrees=num(meta.rotationDegrees??0),zIndex=num(o.zIndex);
 if(scale<=0||scale>10||Math.abs(rotationDegrees)>360||!Number.isInteger(zIndex))return fail();
 return{id:lid,key:str(o.key),displayName:str(o.displayName),kind,version:ver(o.version),mediaType:media as Media|null,assetKey:kind==="MEDIA"?key(o.assetKey,String(media).toLowerCase()):null,posterAssetKey:o.posterAssetKey===null?null:key(o.posterAssetKey,"png"),positionX:num(o.positionX),positionY:num(o.positionY),scale,rotationDegrees,zIndex,anchor,enabled:o.enabled}
}
export function parseScene(v:unknown,worldId:string):CoreScene{
 const o=obj(v),sid=id(o.id),status=o.status;if(o.worldId!==worldId||(status!=="ACTIVE"&&status!=="DISABLED"))return fail();
 const layers=list(o.layers).map(l=>layer(l,sid));
 if(layers.filter(l=>l.kind==="CHARACTER").length!==1||new Set(layers.map(l=>l.id)).size!==layers.length)return fail();
 return{id:sid,worldId,key:str(o.key),displayName:str(o.displayName),descriptionText:str(o.descriptionText),version:ver(o.version),canvasWidth:num(o.canvasWidth),canvasHeight:num(o.canvasHeight),baseAssetKey:key(o.baseAssetKey,"png"),sortOrder:num(o.sortOrder),status,layers}
}
function world(v:unknown):CoreWorld{
 const o=obj(v),wid=id(o.id),worldType=o.worldType,status=o.status;
 if(worldType!=="CORE"&&worldType!=="SUMMER"&&worldType!=="SPECIAL"&&worldType!=="OTHER")return fail();
 if(status!=="DRAFT"&&status!=="ACTIVE"&&status!=="ARCHIVED")return fail();
 const scenes=list(o.scenes).map(s=>parseScene(s,wid));if(new Set(scenes.map(s=>s.id)).size!==scenes.length)return fail();
 const date=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?v:null;const name=(v:unknown)=>typeof v==="string"&&v.trim()&&v.length<=160?v.trim():null;return{createdAt:date(o.createdAt),updatedAt:date(o.updatedAt),createdByUser:name(o.createdByUser),updatedByUser:name(o.updatedByUser),id:wid,key:str(o.key),displayName:str(o.displayName),descriptionText:str(o.descriptionText),version:ver(o.version),worldType,status,scenes}
}
async function request(fetcher:typeof fetch,path:string,init:RequestInit={}):Promise<unknown>{
 const r=await fetcher(root+path,{...init,credentials:"same-origin",cache:"no-store",signal:init.signal??AbortSignal.timeout(20000)});
 const raw=obj(await r.json());if(!r.ok)throw Error("Core chưa xác nhận thao tác World (HTTP "+r.status+").");
 if(!Object.hasOwn(raw,"data"))return fail();return raw.data;
}
function json(method:string,body:unknown,replay?:string):RequestInit{
 return{method,headers:{"content-type":"application/json",...(replay?{"idempotency-key":replay}:{})},body:JSON.stringify(body)}
}
export async function fetchWorldCatalog(fetcher:typeof fetch=fetch,signal?:AbortSignal){
 const result=list(obj(await request(fetcher,"",{method:"GET",signal})).worlds).map(world);
 if(new Set(result.map(w=>w.id)).size!==result.length)return fail();return result;
}
const findWorld=(worlds:CoreWorld[],worldId:string)=>worlds.find(w=>w.id===worldId)??fail();
export async function patchWorld(worldId:string,patch:{expectedVersion:number;displayName?:string;descriptionText?:string;worldType?:CoreWorld["worldType"]},fetcher:typeof fetch=fetch){
 const result=world(await request(fetcher,"/"+id(worldId),json("PATCH",patch)));
 const fresh=findWorld(await fetchWorldCatalog(fetcher),worldId);
 if(result.id!==worldId||result.version!==patch.expectedVersion+1||fresh.version!==result.version)return fail();
 for(const f of ["displayName","descriptionText","worldType"] as const)if(patch[f]!==undefined&&(result[f]!==patch[f]?.trim()||fresh[f]!==result[f]))return fail();
 return fresh;
}
export type SceneCreate={expectedWorldVersion:number;key:string;displayName:string;descriptionText?:string;canvasWidth:number;canvasHeight:number;baseAssetKey:string};
export async function createScene(worldId:string,body:SceneCreate,replay:string,fetcher:typeof fetch=fetch){
 const result=parseScene(await request(fetcher,"/"+id(worldId)+"/scenes",json("POST",body,replay)),worldId);
 const fresh=findWorld(await fetchWorldCatalog(fetcher),worldId),scene=fresh.scenes.find(s=>s.id===result.id);
 if(!scene||scene.version!==result.version||scene.key!==body.key||scene.baseAssetKey!==body.baseAssetKey||scene.displayName!==body.displayName.trim()||scene.canvasWidth!==body.canvasWidth||scene.canvasHeight!==body.canvasHeight)return fail();
 return fresh;
}
export type UiGeometry={x:number;y:number;scale:number;rotation:number};
type Geometry={positionX:number;positionY:number;scale:number;rotationDegrees:number};
export function toUiGeometry(l:CoreLayer):UiGeometry{return{x:50+l.positionX,y:50+l.positionY,scale:l.scale*100,rotation:l.rotationDegrees}}
export function toCoreGeometry(g:UiGeometry):Geometry{
 if(![g.x,g.y,g.scale,g.rotation].every(Number.isFinite)||g.x<0||g.x>100||g.y<0||g.y>100||g.scale<=0||g.scale>1000||Math.abs(g.rotation)>360)throw Error("Thông số calibration không hợp lệ.");
 return{positionX:g.x-50,positionY:g.y-50,scale:g.scale/100,rotationDegrees:g.rotation}
}
type DraftCharacter=UiGeometry&{kind:"CHARACTER";id:string};
type DraftMedia=UiGeometry&{kind:"MEDIA";id:string|null;key:string;displayName:string;mediaType:Media;assetKey:string;posterAssetKey:string|null;enabled:boolean};
export type SceneDraftLayer=DraftCharacter|DraftMedia;
export function sceneSaveBody(scene:CoreScene,draft:SceneDraftLayer[]){
 const seen=new Set<string>(),previous=new Map(scene.layers.map(l=>[l.id,l]));
 if(draft.filter(l=>l.kind==="CHARACTER").length!==1||draft.length>40)throw Error("Cảnh phải có một Character.");
 const layers=draft.map(l=>{
  const geometry=toCoreGeometry(l);
  if(l.id!==null){if(seen.has(l.id)||previous.get(l.id)?.kind!==l.kind)throw Error("Layer không thuộc cảnh.");seen.add(l.id)}
  if(l.kind==="CHARACTER"){if(l.id!==scene.id)return fail();return{kind:l.kind,id:l.id,...geometry}}
  if(l.mediaType==="WEBM"&&(l.id===null||previous.get(l.id)?.assetKey!==l.assetKey))throw Error("Chỉ giữ WEBM hiện hữu.");
  return{kind:l.kind,id:l.id,key:l.key,displayName:l.displayName.trim(),mediaType:l.mediaType,assetKey:key(l.assetKey,l.mediaType.toLowerCase()),posterAssetKey:l.posterAssetKey===null?null:key(l.posterAssetKey,"png"),enabled:l.enabled,...geometry}
 });
 return{expectedVersion:scene.version,expectedLayers:scene.layers.map(l=>({id:l.id,version:l.version})),displayName:scene.displayName,descriptionText:scene.descriptionText,baseAssetKey:scene.baseAssetKey,layers}
}
export async function saveScene(scene:CoreScene,draft:SceneDraftLayer[],replay:string,fetcher:typeof fetch=fetch){
 const body=sceneSaveBody(scene,draft),receipt=obj(await request(fetcher,"/scenes/"+id(scene.id)+"/save",json("PUT",body,replay)));
 const ordered=list(receipt.layerIds).map(id);
 if(receipt.sceneId!==scene.id||receipt.version!==scene.version+1||ordered.length!==draft.length||new Set(ordered).size!==ordered.length)return fail();
 const fresh=findWorld(await fetchWorldCatalog(fetcher),scene.worldId),saved=fresh.scenes.find(s=>s.id===scene.id);
 if(!saved||saved.version!==receipt.version||saved.layers.length!==ordered.length)return fail();
 const stack=[...saved.layers].sort((a,b)=>b.zIndex-a.zIndex);
 if(stack.some((l,i)=>{const d=draft[i],g=body.layers[i];return !d||!g||l.id!==ordered[i]||(d.id!==null&&l.id!==d.id)||l.kind!==d.kind||l.positionX!==g.positionX||l.positionY!==g.positionY||l.scale!==g.scale||l.rotationDegrees!==g.rotationDegrees||(d.kind==="MEDIA"&&(l.assetKey!==d.assetKey||l.mediaType!==d.mediaType||l.enabled!==d.enabled||l.posterAssetKey!==d.posterAssetKey||l.key!==d.key||l.displayName!==d.displayName.trim()))}))return fail();
 return fresh;
}
export async function uploadSceneMedia(file:File,replay:string,fetcher:typeof fetch=fetch){
 if(file.size<1||file.size>8*1024*1024||!["image/png","image/gif"].includes(file.type))throw Error("Chọn PNG/GIF tối đa 8 MB.");
 const form=new FormData();form.set("file",file);
 const r=obj(await request(fetcher,"/media",{method:"POST",headers:{"idempotency-key":replay},body:form}));
 const mediaType=file.type==="image/gif"?"GIF":"PNG";
 if(r.mediaType!==mediaType||r.byteSize!==file.size)return fail();
 return{mediaType,objectKey:key(r.objectKey,mediaType.toLowerCase())};
}

const historyActions:Record<string,[string,string]>={PINORIA_WORLD_CREATED:["pinoria_world","Tạo World"],PINORIA_WORLD_UPDATED:["pinoria_world","Cập nhật World"],PINORIA_WORLD_SCENE_CREATED:["pinoria_world_scene","Tạo cảnh"],PINORIA_WORLD_SCENE_UPDATED:["pinoria_world_scene","Cập nhật cảnh"],PINORIA_WORLD_SCENE_SAVED:["pinoria_world_scene","Lưu cảnh"],PINORIA_WORLD_SCENE_DELETED:["pinoria_world_scene","Xóa cảnh"],PINORIA_WORLD_LAYER_CREATED:["pinoria_world_scene_layer","Thêm layer"],PINORIA_WORLD_LAYER_UPDATED:["pinoria_world_scene_layer","Cập nhật layer"],PINORIA_WORLD_LAYER_DELETED:["pinoria_world_scene_layer","Xóa layer"]};
export type WorldHistory={events:{id:string;occurredAt:string;label:string;actorName:string|null}[];truncated:boolean};
export async function fetchWorldHistory(worldId:string,fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<WorldHistory>{
 const o=obj(await request(fetcher,"/"+id(worldId)+"/history",{method:"GET",signal})),rows=list(o.events);
 if(rows.length>100||typeof o.truncated!=="boolean")return fail();
 const events=rows.map(v=>{const r=obj(v),action=str(r.action),entry=Object.hasOwn(historyActions,action)?historyActions[action]:undefined,occurredAt=str(r.occurredAt);
  if(!entry||entry[0]!==r.subjectType||!Number.isFinite(Date.parse(occurredAt))||Object.keys(r).some(k=>!["id","occurredAt","action","subjectType","actorName"].includes(k)))return fail();
  const actorName=r.actorName===null?null:str(r.actorName);if(actorName!==null&&(!actorName.trim()||actorName.length>160))return fail();
  return {id:id(r.id),occurredAt,label:entry[1],actorName};
 });
 if(new Set(events.map(e=>e.id)).size!==events.length)return fail();
 return {events,truncated:o.truncated};
}
