/** PAP-2153: parse only the canonical saved Self composition, not Item catalog or asset paths. */
import {parseAvatarWorld,type Scope} from "./avatar-world-contract";
const ORDER=["AURA_GROUND","AURA_BACK","BACK","CHAR_BASE","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"] as const;
const SLOTS=["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"] as const;
type Slot=typeof SLOTS[number];
const fail=():never=>{throw Error("Không xác minh được trang bị Avatar.");};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function obj(v:unknown):Record<string,unknown>{return v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:fail();}
function id(v:unknown){return typeof v==="string"&&uuid.test(v)?v:fail();}
function num(v:unknown,min:number,max:number){return typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max?v:fail();}
function ver(v:unknown,min=0){const n=num(v,min,Number.MAX_SAFE_INTEGER-1);return Number.isSafeInteger(n)?n:fail();}
function member(v:unknown,slot?:Slot){
 const m=obj(v),actual=m.slot;
 if(!SLOTS.includes(actual as Slot)||(slot!==undefined&&actual!==slot)||typeof m.displayName!=="string"||!m.displayName.trim())return fail();
 return {itemId:id(m.itemId),slot:actual as Slot,displayName:m.displayName,positionX:num(m.positionX,-1,1),positionY:num(m.positionY,-1,1),scale:num(m.scale,Number.MIN_VALUE,10),rotationDegrees:m.rotationDegrees===null?null:num(m.rotationDegrees,-360,360)};
}
type Member=ReturnType<typeof member>;
export function parseWorldComposition(raw:unknown,scope:Scope){
 const state=parseAvatarWorld(raw,scope),r=obj(raw),base=obj(r.loadout),c=obj(r.composition),slots=obj(base.slots);
 if(c.selfId!==scope.selfId||!Object.hasOwn(c,"activeSet")||typeof c.ready!=="boolean"||typeof base.ready!=="boolean"||Object.keys(slots).sort().join(",")!==[...SLOTS].sort().join(",")||!Array.isArray(base.renderStack)||JSON.stringify(base.renderStack)!==JSON.stringify(ORDER))return fail();
 const parsed=Object.fromEntries(SLOTS.map(slot=>[slot,slots[slot]===null?null:member(slots[slot],slot)])) as Record<Slot,Member|null>;
 const ready=!!(parsed.HAIR&&parsed.FACE&&parsed.OUTFIT);
 if(ready!==base.ready)return fail();
 const setVersion=ver(c.setVersion),selfVersion=ver(c.selfVersion,1);
 const loadout={version:state.loadoutVersion,slots:parsed,renderStack:ORDER};
 if(c.activeSet===null){if(c.ready!==ready)return fail();return {loadout,activeSet:null,setVersion,selfVersion};}
 const set=obj(c.activeSet);
 if(ver(set.version,1)!==setVersion||!Array.isArray(set.members)||set.members.length<1||set.members.length>8)return fail();
 const members=set.members.map(m=>member(m));
 if(new Set(members.map(m=>m.slot)).size!==members.length||!["HAIR","FACE","OUTFIT"].every(slot=>members.some(m=>m.slot===slot))||c.ready!==true)return fail();
 return {loadout,activeSet:{setItemId:id(set.setItemId),version:setVersion,membershipRevision:ver(set.membershipRevision,1),members},setVersion,selfVersion};
}

/** PAP-2186: remount only on actual scoped composition identity changes; not a media request revision guard. */
export function worldCompositionFrameKey(scope:Scope,model:ReturnType<typeof parseWorldComposition>){
 const memberKey=(m:Member|null)=>m===null?null:[m.slot,m.itemId,m.positionX,m.positionY,m.scale,m.rotationDegrees];
 const set=model.activeSet;
 return JSON.stringify([scope.selfId,scope.centerId,scope.studentProfileId,model.selfVersion,model.loadout.version,model.setVersion,
  set===null?["slots",...SLOTS.map(slot=>memberKey(model.loadout.slots[slot]))]:["set",set.setItemId,set.membershipRevision,...set.members.map(memberKey)]]);
}
