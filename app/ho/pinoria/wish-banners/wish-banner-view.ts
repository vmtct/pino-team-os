/** PAP-2030 / PNR-WISH — native banner View and dedicated Item ledger projection. */
import type {BoField,BoModule,BoRecord} from "@/lib/bo-registration";
import type {BannerValue,WishConfigHead} from "@/lib/pls-wish-ho-contract";
const field=(key:string,label:string,type:BoField["type"]="text",w=155):BoField=>({key,label,type,w,icon:type==="number"?"#":"Aa",readonly:true});
export const wishBannerModule:BoModule={label:"Wish Banners",group:"Pinoria",fields:[
 field("name","Banner","text",220),field("version","Version","number",100),field("status","Status","select",120),field("center","Center scope","text",220),
 field("startsAt","Start","datetime",185),field("endsAt","End","datetime",185),
 field("createdAt","Created Time","datetime",185),field("createdByUser","Created by (User)","text",180),field("updatedAt","Last Modified Time","datetime",185),field("updatedByUser","Last Modified by (User)","text",190)
]};
export const wishBannerItemModule:BoModule={label:"Item",group:"Pinoria",fields:[
 field("itemId","Item ID","id",280),field("itemRevision","Revision","number",100),field("rarity","Rarity","number",100),
 field("weight","Weight","number",120),field("relativeShare","Relative pool weight (%)","number",170),field("featured","Featured","boolean")
]};
export function bannerView(head:WishConfigHead<BannerValue>,selection:"published"|"pending",centerLabel:string|null){
 const revision=selection==="published"?head.published:head.pendingDraft;
 if(!revision)throw Error("Không có phiên bản Banner được chọn.");
 const v=revision.value;
 const row:BoRecord={id:head.recordId,name:revision.name,version:"sequence" in revision?revision.sequence:revision.version,
 status:selection==="published"?(head.active?"PUBLISHED":"RETIRED"):(head.staleDraft?"STALE_DRAFT":"DRAFT"),
 center:v.centerId===null?"Global":centerLabel?.trim()||null,startsAt:v.startsAt,endsAt:v.endsAt,
 createdAt:head.audit?.createdAt??null,createdByUser:head.audit?.createdByUser??null,updatedAt:head.audit?.updatedAt??null,updatedByUser:head.audit?.updatedByUser??null};
 // Display-only relative pool share, not a chance of drawing. Scaling avoids overflow.
 const max=Math.max(...v.pool.map(i=>i.weight)),total=v.pool.reduce((sum,i)=>sum+i.weight/max,0);
 const itemRows:BoRecord[]=v.pool.map(i=>({id:i.itemId,name:"—",itemId:i.itemId,itemRevision:i.revision,rarity:i.rarity??null,weight:i.weight,
 relativeShare:Number((100*(i.weight/max)/total).toFixed(8)),featured:i.featured}));
 return {row,itemRows};
}
