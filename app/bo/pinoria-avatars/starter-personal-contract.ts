// PAP-1979 / PAP-1974: pure BO command boundary; not mounted until Core admission.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Choice={setItemId:string;membershipRevision:number;memberCount:number};
type State={selfId:string;version:number;selfVersion:number;starterAvailable:boolean;starterSets:readonly Choice[]};
type Loadout={selfId:string;version:number;ready:boolean;slots:Record<string,{itemId:string}|null>};
const integer=(v:number,min:number)=>Number.isSafeInteger(v)&&v>=min;
const reject=():never=>{throw Error("Starter hoặc phiên bản Avatar không hợp lệ. Hãy tải lại.");};
export function personalStarterIntent(state:State,base:Loadout,selectedId:string,reason:string,key:string){
 const choice=state.starterSets.find(x=>x.setItemId===selectedId);
 if(!state.starterAvailable||!choice||!UUID.test(selectedId)||!UUID.test(state.selfId)||state.selfId!==base.selfId||
 !integer(state.version,0)||!integer(state.selfVersion,1)||!integer(base.version,0)||
 !integer(choice.membershipRevision,1)||!integer(choice.memberCount,3)||choice.memberCount>8||
 !UUID.test(key)||!reason.trim()||reason.trim().length>1000)return reject();
 return {key, selfId:state.selfId,memberCount:choice.memberCount, body:{setItemId:selectedId,expectedVersion:state.version,
 expectedSelfVersion:state.selfVersion,expectedMembershipRevision:choice.membershipRevision,
 expectedLoadoutVersion:base.version,reason:reason.trim()}};
}
type Intent=ReturnType<typeof personalStarterIntent>;
type ReadState=State&{setItemId:string|null};
export type Receipt={selfId:string;version:number;selfVersion:number;setItemId:null;equipMode:"PERSONAL_SLOTS";
 starterSetItemId:string;starterMembershipRevision:number;loadoutVersion:number;starterOrigin:"CREATE_AVATAR"|"LATE_CLAIM";starterMembers:{itemId:string;slot:string}[]};
export function verifyPersonalStarter(intent:Intent,receipt:Receipt,read:ReadState,base:Loadout){
 const b=intent.body;
 if(receipt.starterOrigin!=="LATE_CLAIM"||receipt.selfId!==intent.selfId||receipt.equipMode!=="PERSONAL_SLOTS"||receipt.setItemId!==null||
 receipt.starterSetItemId!==b.setItemId||receipt.starterMembershipRevision!==b.expectedMembershipRevision||
 receipt.version!==b.expectedVersion+1||receipt.selfVersion!==b.expectedSelfVersion+1||
 receipt.loadoutVersion!==b.expectedLoadoutVersion+1||read.selfId!==intent.selfId||
 read.version!==receipt.version||read.selfVersion!==receipt.selfVersion||read.setItemId!==null||
 read.starterAvailable||read.starterSets.length!==0||base.selfId!==intent.selfId||
 base.version!==receipt.loadoutVersion||!base.ready||
 !["HAIR","FACE","OUTFIT"].every(slot=>UUID.test(base.slots[slot]?.itemId??"")))return reject();
 verifyStarterMembers(receipt,base,intent.memberCount);
}

const SLOTS=new Set(["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"]);
function verifyStarterMembers(receipt:Receipt,base:Loadout,count:number){
 const members=receipt.starterMembers;
 if(!Array.isArray(members)||members.length!==count||count<3||count>8||
 members.some(m=>!m||!UUID.test(m.itemId)||!SLOTS.has(m.slot)||base.slots[m.slot]?.itemId!==m.itemId)||
 new Set(members.map(m=>m.slot)).size!==count||new Set(members.map(m=>m.itemId)).size!==count||
 !["HAIR","FACE","OUTFIT"].every(s=>members.some(m=>m.slot===s)))return reject();
}
export function verifyCreatedStarter(choice:Choice,receipt:Receipt,read:ReadState,base:Loadout){
 if(receipt.starterOrigin!=="CREATE_AVATAR"||!UUID.test(receipt.selfId)||receipt.equipMode!=="PERSONAL_SLOTS"||
 receipt.starterSetItemId!==choice.setItemId||receipt.starterMembershipRevision!==choice.membershipRevision||
 receipt.setItemId!==null||receipt.version!==1||receipt.selfVersion!==2||receipt.loadoutVersion!==1||
 read.selfId!==receipt.selfId||read.version!==1||read.selfVersion!==2||read.setItemId!==null||
 read.starterAvailable||read.starterSets.length!==0||base.selfId!==receipt.selfId||base.version!==1||!base.ready)return reject();
 verifyStarterMembers(receipt,base,choice.memberCount);
}
export type StarterChoice=Choice&{displayName:string};
export function parseStarterCatalog(raw:unknown):StarterChoice[]{
 const data=(raw as {data?:unknown})?.data;
 if(!Array.isArray(data)||data.some((s:StarterChoice)=>!s||!UUID.test(s.setItemId)||typeof s.displayName!=="string"||!s.displayName.trim()||!integer(s.membershipRevision,1)||!integer(s.memberCount,3)||s.memberCount>8)||new Set(data.map((s:StarterChoice)=>s.setItemId)).size!==data.length)return reject();
 return data as StarterChoice[];
}
export function retryKey(previous:{signature:string;key:string}|null,signature:string,makeKey:()=>string){
 return previous?.signature===signature?previous:{signature,key:makeKey()};
}
