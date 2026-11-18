/** PAP-2030/PAP-2032 — exact Full Detail URL state, not an authorization proof. */
export type WishDetailKind="policy"|"banner"|"event";
export type WishDetailTab="overview"|"items"|"history";
export type WishRevisionSelection="published"|"pending";
export type WishRevisionRef={selection:WishRevisionSelection;revision:string};
export type WishRewardRef={ordinal:number;itemId:string;revision:number};
export type WishDetailRoute={record:string;tab:WishDetailTab;centerId?:string;version?:WishRevisionRef;reward?:WishRewardRef};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function readWishDetailRoute(search:string,kind:WishDetailKind,centerId?:string):WishDetailRoute|null{
 const p=new URLSearchParams(search),record=p.get("record"),tab=p.get("tab")??"overview",center=p.get("wishCenter"),selection=p.get("wishSelection"),revision=p.get("wishRevision"),ordinal=p.get("rewardOrdinal"),item=p.get("rewardItem"),itemRevision=p.get("rewardRevision"),rewardKeys=["rewardOrdinal","rewardItem","rewardRevision"],hasReward=rewardKeys.some(k=>p.has(k));
 if(!record&&!p.has("record")&&!p.has("tab")&&!p.has("wishCenter")&&!p.has("wishSelection")&&!p.has("wishRevision")&&!hasReward)return null;
 if(!record||!uuid.test(record)||p.getAll("record").length!==1||p.getAll("tab").length>1||p.getAll("wishCenter").length>1||!(tab==="overview"||tab==="history"||(tab==="items"&&kind!=="policy")))throw Error("Liên kết Wish Detail không hợp lệ.");
 if(kind==="event"){if(selection!==null||revision!==null)throw Error("Wish Event không có phiên bản cấu hình.");if(!center||!uuid.test(center)||center!==centerId)throw Error("Wish Event không thuộc Center đang chọn.");if(!hasReward)return {record,tab,centerId:center};if(tab!=="items"||rewardKeys.some(k=>p.getAll(k).length!==1)||!ordinal||!/^(?:[1-9]|10)$/.test(ordinal)||!item||!uuid.test(item)||!itemRevision||!/^[1-9][0-9]*$/.test(itemRevision)||!Number.isSafeInteger(Number(itemRevision)))throw Error("Liên kết Item của Wish Event không hợp lệ.");return {record,tab,centerId:center,reward:{ordinal:Number(ordinal),itemId:item,revision:Number(itemRevision)}};}
 if(center!==null||hasReward)throw Error("Phạm vi HO Wish không hợp lệ.");
 if(selection===null&&revision===null)return {record,tab};
 if(p.getAll("wishSelection").length!==1||p.getAll("wishRevision").length!==1||!revision||!(selection==="published"&&uuid.test(revision)||selection==="pending"&&/^[1-9][0-9]*$/.test(revision)&&Number.isSafeInteger(Number(revision))))throw Error("Phiên bản Wish Detail không hợp lệ.");
 return {record,tab,version:{selection:selection as WishRevisionSelection,revision}};
}
export function wishDetailUrl(href:string,kind:WishDetailKind,route:WishDetailRoute|null){
 const url=new URL(href);
 for(const k of ["record","tab","wishCenter","wishSelection","wishRevision","rewardOrdinal","rewardItem","rewardRevision"])url.searchParams.delete(k);
 if(route){url.searchParams.set("record",route.record);url.searchParams.set("tab",route.tab);if(kind==="event"&&route.centerId)url.searchParams.set("wishCenter",route.centerId);if(route.reward){url.searchParams.set("rewardOrdinal",String(route.reward.ordinal));url.searchParams.set("rewardItem",route.reward.itemId);url.searchParams.set("rewardRevision",String(route.reward.revision));}if(route.version){url.searchParams.set("wishSelection",route.version.selection);url.searchParams.set("wishRevision",route.version.revision);}readWishDetailRoute(url.search,kind,route.centerId);}
 return url.pathname+url.search+url.hash;
}
