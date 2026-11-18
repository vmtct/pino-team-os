/** PAP-2032 / PNR-WISH — exact PLS event projection, never ENERGY_SEED. */
import type {BoField,BoModule,BoRecord} from "@/lib/bo-registration";
import type {BoWishEvent,BoWishDetail} from "@/lib/pls-wish-bo-contract";
const f=(key:string,label:string,type:BoField["type"]="text",w=155):BoField=>({key,label,type,w,icon:type==="number"?"#":"Aa",readonly:true});
export const wishEventModule:BoModule={label:"Wish Events",group:"Pinoria",fields:[
 f("name","Học viên","text",240),f("center","Center","text",170),f("banner","Banner","text",200),f("count","Wish","number",90),f("spent","PLS đã dùng","number",125),f("highestRarity","Rarity cao nhất","number",145),f("status","Trạng thái","select",130),f("createdAt","Created Time","datetime",185),f("actor","Created by (User)","text",190),f("reversedAt","Last Modified Time","datetime",185),f("reversedBy","Last Modified by (User)","text",190)
]};
export const wishOutcomeModule:BoModule={label:"Item",group:"Pinoria",fields:[f("ordinal","Thứ tự","number",90),f("name","Item","text",240),f("itemRevision","Revision","number",110),f("rarity","Rarity","number",100),f("duplicate","Trùng Item","boolean",110),f("provenance","Nguồn cấp","text",160),f("grantEventId","Grant Event","id",270)]};
export function wishEventRow(e:BoWishEvent):BoRecord{
 const name=e.learnerName?e.learnerName+(e.learnerGender==="MALE"?" ♂":e.learnerGender==="FEMALE"?" ♀":""):"—";
 return {id:e.eventId,name,center:e.centerName,banner:e.bannerName,count:e.count,spent:e.spent,highestRarity:e.highestRarity,status:e.status,createdAt:e.createdAt,actor:e.actorName,reversedAt:e.reversedAt??e.createdAt,reversedBy:e.reversedAt?e.reversedByName:e.actorName};
}
export function wishOutcomeRows(e:BoWishDetail):BoRecord[]{return e.outcomes.map(o=>({id:e.eventId+":"+o.ordinal,name:o.itemName??"—",ordinal:o.ordinal,itemId:o.itemId,itemRevision:o.itemRevision,rarity:o.rarity,duplicate:o.duplicate,provenance:o.provenance,grantEventId:o.grantEventId}));}
