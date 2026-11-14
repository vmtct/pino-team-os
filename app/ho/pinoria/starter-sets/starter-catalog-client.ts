/** PAP-1978 / PAP-1974: reuse the canonical Item SET client. */
import {getItem,listItems,writeItem,type HoSetItem,type ItemRecord,type SetInput} from "../wardrobe/item-client";
type CatalogClient={list:typeof listItems;get:typeof getItem;write:typeof writeItem};
const canonical:CatalogClient={list:listItems,get:getItem,write:writeItem};
export type StarterSetDraft={key:string;displayName:string;memberItemIds:string[]};
function requireSet(record:ItemRecord):HoSetItem{
 if(record.type!=="SET"||typeof record.starterEligible!=="boolean"||!Array.isArray(record.members))
  throw Error("Core chưa trả đủ thông tin SET.");
 return record;
}
export function isStarter(r:HoSetItem){return r.starterEligible===true||r.pendingDraft?.starterEligible===true;}
export async function loadStarterCatalog(signal?:AbortSignal,client:CatalogClient=canonical){
 const list=await client.list(signal),sets=list.filter(r=>r.type==="SET"),details:HoSetItem[]=[];
 for(let i=0;i<sets.length;i+=4){
  signal?.throwIfAborted();
  details.push(...await Promise.all(sets.slice(i,i+4).map(async row=>{
   const r=requireSet(await client.get(row.id,signal));
   if(r.id!==row.id||r.revision!==row.revision||r.status!==row.status)throw Error("Danh sách SET vừa thay đổi. Tải lại.");
   return r;
  })));
 }
 signal?.throwIfAborted();
 return {starters:details.filter(isStarter),items:list.filter(r=>r.type!=="SET"&&r.status==="PUBLISHED")};
}
export function starterDraft(r:HoSetItem):StarterSetDraft{
 const d=r.pendingDraft;
 return {key:d?.key??r.key,displayName:d?.displayName??r.displayName,memberItemIds:[...(d?.memberItemIds??r.members?.map(m=>m.id)??[])]};
}
function payload(d:StarterSetDraft,r?:HoSetItem):SetInput{
 return {type:"SET",key:d.key.trim(),displayName:d.displayName.trim(),starterEligible:true,memberItemIds:[...d.memberItemIds],
 ...(r?{variantOfItemId:r.pendingDraft?r.pendingDraft.variantOfItemId??null:r.variantOfItemId??null}:{})};
}
async function verify(client:CatalogClient,response:ItemRecord,prev?:HoSetItem){
 const returned=requireSet(response),fresh=requireSet(await client.get(returned.id));
 if(fresh.id!==returned.id||fresh.revision!==returned.revision||fresh.status!==returned.status||
 (prev&&(fresh.id!==prev.id||fresh.revision<=prev.revision))||!isStarter(fresh))throw Error("Chưa xác minh được Starter Set vừa lưu. Tải lại.");
 return fresh;
}
function checkDraft(r:HoSetItem,d:StarterSetDraft){
 if(JSON.stringify(starterDraft(r))!==JSON.stringify({key:d.key.trim(),displayName:d.displayName.trim(),memberItemIds:d.memberItemIds}))throw Error("Core chưa xác nhận nội dung Starter Set.");
 return r;
}
export async function createStarter(d:StarterSetDraft,client:CatalogClient=canonical){
 const r=await verify(client,await client.write("","POST",payload(d)));
 if(r.status!=="DRAFT")throw Error("Core chưa xác nhận bản nháp.");
 return checkDraft(r,d);
}
export async function updateStarter(r:HoSetItem,d:StarterSetDraft,client:CatalogClient=canonical){
 if(!isStarter(r)||r.status==="UNPUBLISHED")throw Error("Starter Set không thể sửa.");
 return checkDraft(await verify(client,await client.write("/"+r.id,"PATCH",{...payload(d,r),expectedRevision:r.revision}),r),d);
}
export async function changeStarterLifecycle(r:HoSetItem,action:"publish"|"unpublish",client:CatalogClient=canonical){
 if(!isStarter(r))throw Error("Không phải Starter Set.");
 if(action==="publish"&&!(r.status==="DRAFT"||(r.status==="PUBLISHED"&&r.pendingDraft)))throw Error("Chưa có bản nháp để Publish.");
 if(action==="unpublish"&&(r.status!=="PUBLISHED"||r.pendingDraft))throw Error("Cần bản Published ổn định để Unpublish.");
 const fresh=await verify(client,await client.write("/"+r.id+"/"+action,"POST",{expectedRevision:r.revision}),r);
 if(fresh.status!==(action==="publish"?"PUBLISHED":"UNPUBLISHED")||fresh.pendingDraft)throw Error("Core chưa xác nhận trạng thái.");
 return fresh;
}
