/** PAP-2288 PLT-LEAD — canonical presentation and single-command lifecycle. */
import {createLeadHouseholdApi,LeadApiError,newLeadCommandKey,type LeadDetail,type LeadRow,type LeadMember,type LeadMemberInput,type LeadReceipt,type LeadInterest,type LeadCreate,type LeadContactInput,type LeadRelationInput} from "@/lib/bo-lead-household-client";
export type LeadHouseholdApi=ReturnType<typeof createLeadHouseholdApi>;
export function presentLeadRow(row:LeadRow){
 return {id:row.id,contactName:row.contactDisplayName,phone:row.phone,lifecycle:row.status,version:row.version,memberCount:row.memberCount,intentCount:row.intentCount,createdAt:row.createdAt,createdBy:row.createdBy,updatedAt:row.updatedAt,updatedBy:row.updatedBy};
}
export function presentLeadDetail(detail:LeadDetail){
 return {...presentLeadRow(detail),primaryContactMemberId:detail.primaryContactMemberId,members:detail.members.map(m=>({...m,intendedRoles:[...m.intendedRoles],interestKinds:[...m.interestKinds],primaryContact:m.id===detail.primaryContactMemberId})),interestKinds:[...new Set<LeadInterest>(detail.members.flatMap(m=>m.interestKinds))],relationships:detail.relationships.map(r=>({...r})),intents:detail.intents.map(i=>({...i})),intentHistoryHasMore:detail.intentHistoryHasMore};
}
/** Keep canonical precision/roles/interests unless explicitly edited. Never send ageObservedAt. */
export function memberInput(member:LeadMember,patch:Partial<LeadMemberInput>={}):LeadMemberInput{
 const {displayName,intendedRoles,gender,birthPrecision,birthYear,birthMonth,birthDay,reportedAge,interestKinds}=member;
 return {...{displayName,intendedRoles:[...intendedRoles],gender,birthPrecision,birthYear,birthMonth,birthDay,reportedAge,interestKinds:[...interestKinds]},...patch};
}
export type LeadCommandState="idle"|"pending"|"uncertain"|"conflict"|"reload_required";
export type LeadCommand =
 | {kind:"create";input:LeadCreate}
 | {kind:"contact";leadId:string;expectedVersion:number;contact:LeadContactInput}
 | {kind:"addMember";leadId:string;expectedVersion:number;member:LeadMemberInput}
 | {kind:"updateMember";leadId:string;expectedVersion:number;memberId:string;member:LeadMemberInput}
 | {kind:"retireMember";leadId:string;expectedVersion:number;memberId:string}
 | {kind:"primary";leadId:string;expectedVersion:number;memberId:string|null}
 | {kind:"addRelation";leadId:string;expectedVersion:number;relationship:LeadRelationInput}
 | {kind:"updateRelation";leadId:string;expectedVersion:number;relationshipId:string;relationship:LeadRelationInput}
 | {kind:"confirmRelation"|"retireRelation";leadId:string;expectedVersion:number;relationshipId:string}
 | {kind:"archive";leadId:string;expectedVersion:number;reason:string};
type Pending={command:LeadCommand;key:string};
function invoke(api:LeadHouseholdApi,c:LeadCommand,k:string):Promise<LeadReceipt>{
 switch(c.kind){
 case "create":return api.create(c.input,k);
 case "contact":return api.contact(c.leadId,c.expectedVersion,c.contact,k);
 case "addMember":return api.addMember(c.leadId,c.expectedVersion,c.member,k);
 case "updateMember":return api.updateMember(c.leadId,c.memberId,c.expectedVersion,c.member,k);
 case "retireMember":return api.retireMember(c.leadId,c.memberId,c.expectedVersion,k);
 case "primary":return api.primary(c.leadId,c.expectedVersion,c.memberId,k);
 case "addRelation":return api.addRelation(c.leadId,c.expectedVersion,c.relationship,k);
 case "updateRelation":return api.updateRelation(c.leadId,c.relationshipId,c.expectedVersion,c.relationship,k);
 case "confirmRelation":return api.confirmRelation(c.leadId,c.relationshipId,c.expectedVersion,k);
 case "retireRelation":return api.retireRelation(c.leadId,c.relationshipId,c.expectedVersion,k);
 case "archive":return api.archive(c.leadId,c.expectedVersion,c.reason,k);
 }
}
function normalizePhone(value:string){const n=value.replace(/\D/g,"").replace(/^84/,"0");return /^0\d{9}$/.test(n)?n:null;}
export class LeadCommandFence{
 private pending:Pending|null=null;
 private phase:LeadCommandState="idle";
 private receipt:LeadReceipt|null=null;
 private conflict:LeadCommand|null=null;
 constructor(private readonly api:LeadHouseholdApi,private readonly makeKey=newLeadCommandKey){}
 get state(){return this.phase;}
 get reloadTarget(){return this.receipt?.leadId??(this.conflict&&this.conflict.kind!=="create"?this.conflict.leadId:null);}
 get isCreateConflict(){return this.phase==="conflict"&&this.conflict?.kind==="create";}
 async submit(command:LeadCommand):Promise<LeadDetail>{
  if(this.phase!=="idle")throw new LeadApiError(409,"LEAD_COMMAND_NOT_READY",null);
  this.pending={command:structuredClone(command),key:this.makeKey()};
  return this.execute();
 }
 async retry():Promise<LeadDetail>{
  if(this.phase!=="uncertain"||!this.pending)throw new LeadApiError(409,"LEAD_RETRY_NOT_READY",null);
  return this.execute();
 }
 private async execute():Promise<LeadDetail>{
  const p=this.pending;if(!p)throw new LeadApiError(409,"LEAD_COMMAND_NOT_READY",null);
  const uncertain=this.phase==="uncertain";this.phase="pending";
  let receipt:LeadReceipt;
  try{receipt=await invoke(this.api,structuredClone(p.command),p.key);}
  catch(error){
   if(uncertain||!(error instanceof LeadApiError)||error.status>=500||error.status===408||error.status===429){this.phase="uncertain";}
   else if(error.status===409){this.phase="conflict";this.conflict=p.command;this.pending=null;}
   else{this.phase="idle";this.pending=null;}
   throw error;
  }
  if(p.command.kind!=="create"&&(receipt.leadId!==p.command.leadId||receipt.version!==p.command.expectedVersion+1)){this.phase="uncertain";throw new LeadApiError(502,"LEAD_RECEIPT_MISMATCH",null);}
  this.receipt=receipt;this.pending=null;this.phase="reload_required";
  return this.reload(receipt.leadId);
 }
 async reload(leadId:string):Promise<LeadDetail>{
  if(this.phase!=="reload_required"&&this.phase!=="conflict")throw new LeadApiError(409,"LEAD_RELOAD_NOT_READY",null);
  if(this.reloadTarget!==leadId)throw new LeadApiError(409,"LEAD_RELOAD_TARGET_MISMATCH",null);
  const before=this.phase,receipt=this.receipt;
  this.phase="pending";
  try{
   const detail=await this.api.detail(leadId);
   if(detail.id!==leadId||receipt&&detail.version<receipt.version)throw new LeadApiError(502,"LEAD_READBACK_MISMATCH",null);
   this.receipt=null;this.conflict=null;this.phase="idle";return detail;
  }catch(error){this.phase=before;throw error;}
 }
 /** Reconcile only the original phone within the actual actor's visible scope. No global absence claim. */
 async reloadCreateConflict():Promise<LeadDetail|null>{
  if(this.phase!=="conflict"||this.conflict?.kind!=="create")throw new LeadApiError(409,"LEAD_RELOAD_NOT_READY",null);
  const phone=normalizePhone(this.conflict.input.contact.phone);
  if(!phone)throw new LeadApiError(400,"INVALID_LEAD_PHONE",null);
  this.phase="pending";
  try{
   let cursor:string|undefined;const seen=new Set<string>();
   for(let i=0;i<100;i++){
    const page=await this.api.search({q:phone,limit:100,...(cursor?{cursor}:{})});
    const row=page.items.find(item=>item.phone===phone);
    if(row){const d=await this.api.detail(row.id);if(d.id!==row.id||d.phone!==phone)throw new LeadApiError(502,"LEAD_READBACK_MISMATCH",null);this.conflict=null;this.phase="idle";return d;}
    if(!page.hasMore){this.conflict=null;this.phase="idle";return null;}
    if(!page.nextCursor||seen.has(page.nextCursor))throw new LeadApiError(502,"LEAD_CURSOR_INVALID",null);
    cursor=page.nextCursor;seen.add(cursor);
   }
   throw new LeadApiError(502,"LEAD_SEARCH_LIMIT",null);
  }catch(error){this.phase="conflict";throw error;}
 }
}
