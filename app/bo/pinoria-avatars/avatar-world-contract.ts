/** PAP-2153 / PAP-8 PNR-WORLD — unmounted selected-Center BO contract.
 * Pure projection and intent only; Core remains authority. No registry or route admission. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=():never=>{throw Error("Core trả về trạng thái World không hợp lệ. Vui lòng tải lại.");};
function object(v:unknown):Record<string,unknown>{return v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:fail();}
function id(v:unknown):string{return typeof v==="string"&&UUID.test(v)?v:fail();}
function text(v:unknown):string{return typeof v==="string"?v:fail();}
function version(v:unknown,min=1):number{return typeof v==="number"&&Number.isSafeInteger(v)&&v>=min&&v<Number.MAX_SAFE_INTEGER-1?v:fail();}
function instant(v:unknown):string{const t=text(v);return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(t)&&Number.isFinite(Date.parse(t))?t:fail();}
function list(v:unknown):unknown[]{return Array.isArray(v)?v:fail();}
function unique(xs:string[]):void{if(new Set(xs).size!==xs.length)fail();}
type WorldStatus="DRAFT"|"ACTIVE"|"ARCHIVED";
type InstanceStatus="INACTIVE"|"LIVE"|"REVOKED";
export type Scope={selfId:string;centerId:string;studentProfileId:string};
type Layer={id:string;displayName:string;kind:"MEDIA"|"CHARACTER";enabled:boolean};
type Scene={id:string;displayName:string;status:"ACTIVE"|"DISABLED";layers:Layer[]};
type World={id:string;displayName:string;status:WorldStatus;version:number;scenes:Scene[]};
function auditName(v:unknown):string|null{return v===null?null:typeof v==="string"&&v.trim()===v&&v.length>0&&v.length<=160&&!UUID.test(v)&&!v.includes("@")?v:fail();}
type Instance={createdAt:string;updatedAt:string;createdByUser:string|null;updatedByUser:string|null;id:string;worldId:string;displayLabel:string;status:InstanceStatus;grantedAt:string;revokedAt:string|null;version:number;world:World;sceneAccess:Readonly<Record<string,boolean>>;unlockedLayerIds:string[]};
export type WorldCapabilities=Readonly<{grant:boolean;configure:boolean;setLive:boolean}>;
export type AvatarWorldState=Scope&{grantableWorlds:World[];instances:Instance[];loadoutVersion:number;capabilities:WorldCapabilities};
export type WorldIntent={kind:"grant";worldId:string;label:string}|{kind:"live";instanceId:string}|{kind:"scene";instanceId:string;sceneId:string;accessible:boolean}|{kind:"layer";instanceId:string;layerId:string;unlocked:boolean};
export type WorldCommand=WorldIntent&{expectedVersion:number};
function world(raw:unknown):World{
 const w=object(raw),wid=id(w.id),status=w.status;
 if(status!=="DRAFT"&&status!=="ACTIVE"&&status!=="ARCHIVED")return fail();
 const scenes=list(w.scenes).map((rawScene):Scene=>{
  const s=object(rawScene),sid=id(s.id),status=s.status;
  if(s.worldId!==wid||(status!=="ACTIVE"&&status!=="DISABLED"))return fail();
  const layers=list(s.layers).map((rawLayer):Layer=>{
   const l=object(rawLayer),lid=id(l.id),kind=l.kind;
   if(l.sceneId!==sid||typeof l.enabled!=="boolean"||(kind!=="CHARACTER"&&kind!=="MEDIA")||(kind==="CHARACTER"?lid!==sid:lid===sid))return fail();
   return {id:lid,displayName:text(l.displayName),kind,enabled:l.enabled};
  });
  unique(layers.map(l=>l.id));if(layers.filter(l=>l.kind==="CHARACTER").length!==1)return fail();
  return {id:sid,displayName:text(s.displayName),status,layers};
 });
 unique(scenes.map(s=>s.id));unique(scenes.flatMap(s=>s.layers.map(l=>l.id)));
 return {id:wid,displayName:text(w.displayName),status,version:version(w.version),scenes};
}
export function parseAvatarWorld(raw:unknown,scope:Scope):AvatarWorldState{
 const r=object(raw);for(const k of ["selfId","centerId","studentProfileId"] as const)if(id(r[k])!==id(scope[k]))return fail();
 const grantableWorlds=list(r.grantableWorlds).map(world);unique(grantableWorlds.map(w=>w.id));
 if(grantableWorlds.some(w=>w.status!=="ACTIVE"))return fail();
 const instances=list(r.instances).map((rawInstance):Instance=>{
  const i=object(rawInstance),status=i.status,w=world(i.world),iid=id(i.id);
  if(i.studentProfileId!==scope.studentProfileId||i.worldId!==w.id||Object.hasOwn(i,"character")||(status!=="LIVE"&&status!=="INACTIVE"&&status!=="REVOKED"))return fail();
  const access=object(i.sceneAccess),known=new Set(w.scenes.map(s=>s.id)),sceneAccess:Record<string,boolean>={};
  if(Object.keys(access).length!==known.size||Object.keys(access).some(k=>!known.has(k)||typeof access[k]!=="boolean"))return fail();
  for(const s of w.scenes)sceneAccess[s.id]=access[s.id]===true;
  const unlockedLayerIds=list(i.unlockedLayerIds).map(id);unique(unlockedLayerIds);
  const media=new Set(w.scenes.flatMap(s=>s.layers.filter(l=>l.kind==="MEDIA").map(l=>l.id)));
  if(unlockedLayerIds.some(l=>!media.has(l)))return fail();
  return {id:iid,worldId:w.id,displayLabel:text(i.displayLabel),status,createdAt:instant(i.createdAt),updatedAt:instant(i.updatedAt),createdByUser:auditName(i.createdByUser),updatedByUser:auditName(i.updatedByUser),grantedAt:instant(i.grantedAt),revokedAt:i.revokedAt===null?null:instant(i.revokedAt),version:version(i.version),world:w,sceneAccess,unlockedLayerIds};
 });
 unique(instances.map(i=>i.id));const active=instances.filter(i=>i.status!=="REVOKED");
 unique(active.map(i=>i.worldId));if(active.filter(i=>i.status==="LIVE").length>1||grantableWorlds.some(w=>active.some(i=>i.worldId===w.id)))return fail();
 const loadout=object(r.loadout);
 if(id(loadout.selfId)!==scope.selfId||typeof loadout.ready!=="boolean")return fail();
 const capabilities=object(r.capabilities);
 if(Object.keys(capabilities).sort().join(",")!=="configure,grant,setLive"||typeof capabilities.grant!=="boolean"||typeof capabilities.configure!=="boolean"||typeof capabilities.setLive!=="boolean")return fail();
 return {...scope,grantableWorlds,instances,loadoutVersion:version(loadout.version,0),capabilities:Object.freeze({grant:capabilities.grant,configure:capabilities.configure,setLive:capabilities.setLive})};
}
/** Only explicit scoped permission flags, never infer from a visible tab or selected Center. */
export function buildWorldCommand(state:AvatarWorldState,intent:WorldIntent,grants:ReadonlySet<string>):WorldCommand{
 const key=intent.kind==="grant"?"grant":intent.kind==="live"?"set_live":"configure";
 const capability=intent.kind==="grant"?"grant":intent.kind==="live"?"setLive":"configure";
 if(state.capabilities?.[capability]!==true)return fail();
 for(const p of ["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view","pinoria.world.avatar."+key])if(!grants.has(p))return fail();
 if(intent.kind==="grant"){
  const w=state.grantableWorlds.find(w=>w.id===id(intent.worldId)),label=intent.label.trim();
  if(!w||w.status!=="ACTIVE"||!label||label.length>180)return fail();
  return {kind:"grant",worldId:w.id,label,expectedVersion:w.version};
 }
 const i=state.instances.find(i=>i.id===id(intent.instanceId));if(!i||i.status==="REVOKED")return fail();
 if(intent.kind==="live"){if(i.world.status!=="ACTIVE")return fail();return {kind:"live",instanceId:i.id,expectedVersion:i.version};}
 if(intent.kind==="scene"){
  const s=i.world.scenes.find(s=>s.id===id(intent.sceneId));if(!s||typeof intent.accessible!=="boolean"||(intent.accessible&&s.status!=="ACTIVE"))return fail();
  return {kind:"scene",instanceId:i.id,sceneId:s.id,accessible:intent.accessible,expectedVersion:i.version};
 }
 const s=i.world.scenes.find(s=>s.layers.some(l=>l.id===id(intent.layerId)&&l.kind==="MEDIA")),l=s?.layers.find(l=>l.id===intent.layerId);
 if(!s||!l||typeof intent.unlocked!=="boolean"||(intent.unlocked&&(!l.enabled||s.status!=="ACTIVE"||!i.sceneAccess[s.id])))return fail();
 return {kind:"layer",instanceId:i.id,layerId:l.id,unlocked:intent.unlocked,expectedVersion:i.version};
}
export type WorldReceipt=Readonly<{instanceId:string;version:number}>;
export function parseWorldReceipt(command:WorldCommand,raw:unknown):WorldReceipt{
 const r=object(raw),instanceId=id(r.instanceId),v=version(r.version);
 if(v!==(command.kind==="grant"?1:command.expectedVersion+1)||(command.kind!=="grant"&&instanceId!==command.instanceId))return fail();
 return Object.freeze({instanceId,version:v});
}
/** A commit receipt alone is not a UI success. A separate same-scope GET must match. */
export function verifyWorldReadback(previous:Scope,command:WorldCommand,receiptRaw:unknown,fresh:AvatarWorldState):Instance{
 if(fresh.selfId!==previous.selfId||fresh.centerId!==previous.centerId||fresh.studentProfileId!==previous.studentProfileId)return fail();
 const r=parseWorldReceipt(command,receiptRaw),v=r.version,i=fresh.instances.find(i=>i.id===r.instanceId);
 if(!i||i.version!==v||v!==(command.kind==="grant"?1:command.expectedVersion+1))return fail();
 if(command.kind==="grant"){if(i.worldId!==command.worldId||i.displayLabel!==command.label||i.status!=="INACTIVE"||fresh.grantableWorlds.some(w=>w.id===i.worldId))return fail();}
 else{
  if(i.id!==command.instanceId||i.status==="REVOKED")return fail();
  if(command.kind==="live"&&i.status!=="LIVE")return fail();
  if(command.kind==="scene"){
   if(i.sceneAccess[command.sceneId]!==command.accessible)return fail();
   if(!command.accessible&&i.world.scenes.find(s=>s.id===command.sceneId)?.layers.some(l=>i.unlockedLayerIds.includes(l.id)))return fail();
  }
  if(command.kind==="layer"&&i.unlockedLayerIds.includes(command.layerId)!==command.unlocked)return fail();
 }
 return i;
}
