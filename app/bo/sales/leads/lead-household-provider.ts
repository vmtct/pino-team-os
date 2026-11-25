/** PAP-2288 PLT-LEAD — canonical presentation and single-command lifecycle. */
import {createLeadHouseholdApi,LeadApiError,newLeadCommandKey,type LeadDetail,type LeadRow,type LeadMember,type LeadMemberInput,type LeadReceipt,type LeadInterest} from "@/lib/bo-lead-household-client";
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
type Pending={leadId:string|null;key:string;invoke:(key:string)=>Promise<LeadReceipt>};
export class LeadCommandFence{
 private pending:Pending|null=null;
 private phase:LeadCommandState="idle";
 private receipt:LeadReceipt|null=null;
 constructor(private readonly api:Pick<LeadHouseholdApi,"detail">,private readonly makeKey= newLeadCommandKey){}
 get state(){return this.phase;}
 /** Invoke once. Caller supplies the exact command closure and freezes its input at submission. */
 async submit(leadId:string|null,invoke:Pending["invoke"]):Promise<LeadDetail>{
  if(this.phase!=="idle")throw new LeadApiError(409,"LEAD_COMMAND_NOT_READY",null);
  this.pending={leadId,key:this.makeKey(),invoke};
  return this.execute();
 }
 /** Only explicit replay of the same in-memory command and key, never a new command. */
 async retry():Promise<LeadDetail>{
  if(this.phase!=="uncertain"||!this.pending)throw new LeadApiError(409,"LEAD_RETRY_NOT_READY",null);
  return this.execute();
 }
 private async execute():Promise<LeadDetail>{
  const p=this.pending;if(!p)throw new LeadApiError(409,"LEAD_COMMAND_NOT_READY",null);
  const uncertain=this.phase==="uncertain";this.phase="pending";
  let receipt:LeadReceipt;
  try{receipt=await p.invoke(p.key);}
  catch(error){
   if(uncertain||!(error instanceof LeadApiError)||error.status>=500||error.status===408||error.status===429){this.phase="uncertain";}
   else if(error.status===409){this.phase="conflict";this.pending=null;}
   else{this.phase="idle";this.pending=null;}
   throw error;
  }
  if(p.leadId!==null&&receipt.leadId!==p.leadId){this.phase="uncertain";throw new LeadApiError(502,"LEAD_RECEIPT_MISMATCH",null);}
  this.receipt=receipt;this.pending=null;this.phase="reload_required";
  return this.reload(receipt.leadId);
 }
 /** A committed receipt requires authoritative detail readback; no replay/new write on reload failure. */
 async reload(leadId:string):Promise<LeadDetail>{
  if(this.phase!=="reload_required"&&this.phase!=="conflict")throw new LeadApiError(409,"LEAD_RELOAD_NOT_READY",null);
  const before=this.phase,receipt=this.receipt;
  if(receipt&&receipt.leadId!==leadId)throw new LeadApiError(409,"LEAD_RECEIPT_MISMATCH",null);
  this.phase="pending";
  try{
   const detail=await this.api.detail(leadId);
   if(detail.id!==leadId||receipt&&detail.version<receipt.version)throw new LeadApiError(502,"LEAD_READBACK_MISMATCH",null);
   this.receipt=null;this.phase="idle";return detail;
  }catch(error){this.phase=before;throw error;}
 }
}
