// PAP-1979 / PAP-1974: pure BO command boundary; not mounted until Core admission.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Choice={setItemId:string;membershipRevision:number;memberCount:number};
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
 return {key, selfId:state.selfId, body:{setItemId:selectedId,expectedVersion:state.version,
 expectedSelfVersion:state.selfVersion,expectedMembershipRevision:choice.membershipRevision,
 expectedLoadoutVersion:base.version,reason:reason.trim()}};
}
type Intent=ReturnType<typeof personalStarterIntent>;
type ReadState=State&{setItemId:string|null};
type Receipt={selfId:string;version:number;selfVersion:number;setItemId:null;equipMode:"PERSONAL_SLOTS";
 starterSetItemId:string;starterMembershipRevision:number;loadoutVersion:number};
export function verifyPersonalStarter(intent:Intent,receipt:Receipt,read:ReadState,base:Loadout){
 const b=intent.body;
 if(receipt.selfId!==intent.selfId||receipt.equipMode!=="PERSONAL_SLOTS"||receipt.setItemId!==null||
 receipt.starterSetItemId!==b.setItemId||receipt.starterMembershipRevision!==b.expectedMembershipRevision||
 receipt.version!==b.expectedVersion+1||receipt.selfVersion!==b.expectedSelfVersion+1||
 receipt.loadoutVersion!==b.expectedLoadoutVersion+1||read.selfId!==intent.selfId||
 read.version!==receipt.version||read.selfVersion!==receipt.selfVersion||read.setItemId!==null||
 read.starterAvailable||read.starterSets.length!==0||base.selfId!==intent.selfId||
 base.version!==receipt.loadoutVersion||!base.ready||
 !["HAIR","FACE","OUTFIT"].every(slot=>UUID.test(base.slots[slot]?.itemId??"")))return reject();
}
