/** PAP-2030 / PNR-WISH — native policy View projection; no fixture or transport. */
import type {BoField,BoModule,BoRecord} from "@/lib/bo-registration";
import type {PolicyValue,WishConfigHead} from "@/lib/pls-wish-ho-contract";
const field=(key:string,label:string,type:BoField["type"]="text",w=155):BoField=>({key,label,type,w,icon:type==="number"?"#":"Aa",readonly:true});
export const wishPolicyModule:BoModule={label:"Wish Policies",group:"Pinoria",fields:[
 field("name","Policy","text",220),field("version","Version","number",100),field("status","Status","select",120),field("center","Center","text",220),
 field("plsPerWish","PLS / Wish","number"),field("rate3","3★ (%)","number"),field("rate4","4★ (%)","number"),field("rate5","5★ (%)","number"),
 field("hardPity4","Hard pity 4★","number"),field("hardPity5","Hard pity 5★","number"),field("softPityStart","Soft pity start","number"),
 field("featuredGuarantee","Featured guarantee","boolean"),field("media3","Media 3★","text",220),field("media4","Media 4★","text",220),field("media5","Media 5★","text",220),
 field("createdAt","Created Time","datetime",185),field("createdByUser","Created by (User)","text",180),field("updatedAt","Last Modified Time","datetime",185),field("updatedByUser","Last Modified by (User)","text",190)
]};
export function policyView(head:WishConfigHead<PolicyValue>,selection:"published"|"pending",centerLabel:string|null){
 const revision=selection==="published"?head.published:head.pendingDraft;
 if(!revision)throw Error("Không có phiên bản Wish được chọn.");
 const d=revision.value.definition;
 const row:BoRecord={id:head.recordId,name:revision.name,version:"sequence" in revision?revision.sequence:revision.version,status:selection==="published"?(head.active?"PUBLISHED":"RETIRED"):(head.staleDraft?"STALE_DRAFT":"DRAFT"),center:centerLabel?.trim()||null,
 plsPerWish:revision.value.cost,rate3:Number((d.rates[0]*100).toFixed(8)),rate4:Number((d.rates[1]*100).toFixed(8)),rate5:Number((d.rates[2]*100).toFixed(8)),hardPity4:d.hard4,hardPity5:d.hard5,softPityStart:d.soft5,featuredGuarantee:d.featuredGuarantee,media3:d.media?.["3"]??null,media4:d.media?.["4"]??null,media5:d.media?.["5"]??null,
 createdAt:head.audit?.createdAt??null,createdByUser:head.audit?.createdByUser??null,updatedAt:head.audit?.updatedAt??null,updatedByUser:head.audit?.updatedByUser??null};
 // Audit belongs to the record head; media belongs to the selected immutable revision.
 return {row,curve:d.curve.map(s=>({position:s.position,percentage:Number((s.rate*100).toFixed(8))})),revisionCreatedAt:revision.createdAt,revisionActorId:revision.actorUserId};
}
