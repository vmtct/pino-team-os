/** PAP-2288 / PLT-LEAD — view-only projection, never synthesize acquisition intents. */
import type {LeadRow,LeadDetail,LeadIntent} from "@/lib/bo-lead-household-client";
import type {LeadM1Record,LeadM1Member} from "./lead-household-presentation";
export function leadReadRow(row:LeadRow):LeadM1Record {
 return {id:row.id,fixture:false,contactName:row.contactDisplayName??"—",phone:row.phone,lifecycle:row.status,
  memberCount:row.memberCount,intentCount:row.intentCount,members:[],relationships:[],intents:[],
  websiteSubmittedName:row.websiteSubmittedName,websiteProgram:row.websiteProgram,
  createdAt:row.createdAt,updatedAt:row.updatedAt,createdBy:null,updatedBy:null};
}
export function leadReadDetail(detail:LeadDetail):LeadM1Record {
 const gender=(value:LeadDetail["members"][number]["gender"]):LeadM1Member["gender"]=>value==="MALE"?"Nam":value==="FEMALE"?"Nữ":value==="OTHER"?"Khác":"—";
 return {...leadReadRow(detail),members:detail.members.map(member=>({id:member.id,name:member.displayName,
  age:member.reportedAge,gender:gender(member.gender),roles:[...member.intendedRoles],
  primaryContact:member.id===detail.primaryContactMemberId,interestKinds:[...member.interestKinds]})),
  relationships:detail.relationships.map(r=>({id:r.id,fromMemberId:r.fromMemberId,toMemberId:r.toMemberId,label:r.relationLabel,status:r.status})),
  interestKinds:[...new Set(detail.members.flatMap(member=>member.interestKinds))]};
}
export function leadAuditTime(value:string|null):string {
 if(!value)return "—";
 const parsed=new Date(value);
 if(Number.isNaN(parsed.getTime()))return "—";
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(parsed);
 const get=(kind:string)=>parts.find(p=>p.type===kind)?.value??"";
 return get("day")+"/"+get("month")+"/"+get("year")+" · "+get("hour")+":"+get("minute");
}
export function websiteProgramLabel(program:LeadRow["websiteProgram"]):string|null {
 return program==="AFTERSCHOOL"?"PINO Afterschool":program==="MYTIME"?"MyTime by PINO":null;
}
export function websiteInquirySummary(intent:LeadIntent):string|null {
 const metadata=intent.websiteInterest;if(!metadata)return null;
 const s=metadata.interest;
 const selection=s.program==="AFTERSCHOOL"?[{ "little-piner":"Little Piner",artchitect:"Artchitect",pianohouse:"PianoHouse",advice:"Tư vấn" }[s.path],s.planSessions===null?null:s.planSessions+" buổi"]:[{acrylic:"Acrylic",piano:"Piano",advice:"Tư vấn"}[s.activity],s.favoriteRef===null?null:"Lựa chọn: "+s.favoriteRef];
 return [websiteProgramLabel(s.program),...selection].filter(Boolean).join(" · ");
}
export function leadInquiryLabel(intent:LeadIntent):string {
 return {OPEN_STUDIO:"Open Studio",PROGRAM_INTEREST:"Quan tâm chương trình",GENERAL_INQUIRY:"Tư vấn chung"}[intent.kind];
}
