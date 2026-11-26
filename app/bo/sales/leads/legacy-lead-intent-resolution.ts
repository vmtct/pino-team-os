/** PAP-2288 / PLT-LEAD — F1 continuation resolves only an authorized household, never an alias grant. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding} from "@/lib/bo-core";
import type {TeamCredential} from "@/lib/team-auth";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const leadUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Result={status:200;leadId:string;href:string}|{status:400|401|403|404|503};
function data(body:unknown):Record<string,unknown>|null{
 if(!body||typeof body!=="object"||!("data" in body))return null;
 const value=body.data;
 return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
const denied=(status:number):Result=>({status:status===401||status===403||status===404?status:503});
export async function resolveLegacyLeadIntent(binding:BoAccessCoreBinding,credential:TeamCredential,actorId:string,intentId:string):Promise<Result>{
 if(!uuid.test(intentId)||!uuid.test(actorId))return {status:400};
 if(credential.kind!=="password")return {status:403};
 try{
  const context=await callBoAccessCoreWithCredential(binding,{method:"GET",path:"context"},credential);
  if(context.status!==200)return denied(context.status);
  const principal=data(context.body);
  if(!principal||principal.userId!==actorId||principal.surface!=="BO"||principal.entitled!==true||!Array.isArray(principal.permissionKeys)||!principal.permissionKeys.includes("acquisition.lead.manage"))return {status:403};
  const response=await callBoAccessCoreWithCredential(binding,{method:"GET",path:"acquisition/intents/"+intentId},credential);
  if(response.status!==200)return denied(response.status);
  const intent=data(response.body);
  if(!intent||intent.id!==intentId||typeof intent.leadId!=="string"||!leadUuid.test(intent.leadId))return {status:503};
  const leadId=intent.leadId;
  // A legacy intent permission is not proof that the entire household is visible.
  const household=await callBoAccessCoreWithCredential(binding,{method:"GET",path:"acquisition/households/"+leadId},credential);
  if(household.status!==200)return denied(household.status);
  if(data(household.body)?.id!==leadId)return {status:503};
  return {status:200,leadId,href:"/bo/sales/leads?lead="+leadId+"&tab=history"};
 }catch{return {status:503};}
}
