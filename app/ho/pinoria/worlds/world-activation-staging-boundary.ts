/** PAP-2143 / PNR-WORLD — authenticated Staging M1-B, synthetic transport only. */
import type {WorldPreviewBoundary} from "./HoWorldCatalog";
import {createWorldActivationFixture,WORLD_M1_ID,WORLD_M1_MARKER,WORLD_M1_ROUTE} from "./world-activation-m1-fixture";
const origin="https://ho.staging.pinohouse.art";
const tabs=["overview","scenes","preview","history"];
export function readWorldStagingRef(url:URL){
 const q=url.searchParams,record=q.get("record"),surface=q.get("surface"),tab=q.get("tab");
 if(url.origin!==origin||url.pathname!==WORLD_M1_ROUTE||url.hash||
 [...q.keys()].some(k=>!["record","surface","tab"].includes(k)||q.getAll(k).length!==1)||
 (record!==null&&record!==WORLD_M1_MARKER)||(surface!==null&&(record!==WORLD_M1_MARKER||surface!=="detail"))||
 (tab!==null&&(surface!=="detail"||!tabs.includes(tab))))throw Error("Liên kết World mô phỏng không hợp lệ.");
 return {id:record?WORLD_M1_ID:null,tab:surface==="detail"?tab??"overview":null};
}
export function worldStagingRef(id:string|null,tab?:string){
 if((id!==null&&id!==WORLD_M1_ID)||(tab!==undefined&&(id!==WORLD_M1_ID||!tabs.includes(tab))))throw Error("Liên kết World mô phỏng không hợp lệ.");
 const q=new URLSearchParams();if(id)q.set("record",WORLD_M1_MARKER);if(tab){q.set("surface","detail");q.set("tab",tab);}
 return WORLD_M1_ROUTE+(q.size?"?"+q.toString():"");
}
export function createWorldStagingBoundary(canManage:boolean):WorldPreviewBoundary{
 return {transport:createWorldActivationFixture({canManage}),readRef:()=>readWorldStagingRef(new URL(location.href)),writeRef(id,tab,push=false){
  readWorldStagingRef(new URL(location.href));
  const next=worldStagingRef(id,tab);
  if(push)history.pushState(null,"",next);else history.replaceState(null,"",next);
 }};
}
