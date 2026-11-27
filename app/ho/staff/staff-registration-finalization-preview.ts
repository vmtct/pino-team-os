// PAP-2420 · WFM-STAFF. Presentation-only registration finalization, never a live command.
export type ReviewedDossierReceipt=Readonly<{registrationRequestId:string;centerId:string;status:"REVIEWED_FOR_HO";reviewedVersion:number;reviewedBy:string}>;
export type Dossier=Readonly<{id:string;version:number;name:string;email:string;mobile:string|null;centerId:string;documents:{front:boolean;back:boolean};receipt:ReviewedDossierReceipt|null}>;
export type RoleOption=Readonly<{id:string;label:string;active:boolean;scopes:readonly ("CENTER"|"GLOBAL")[]}>;
export type FinalizeRequest=Readonly<{receipt:ReviewedDossierReceipt;roleId:string;scopeType:"CENTER"|"GLOBAL";scopeId:string|null;key:string}>;
type Completed=Readonly<{registrationRequestId:string;status:"APPROVED";reviewedVersion:number;personId:string;staffId:string;userId:string;roleId:string;scopeType:"CENTER"|"GLOBAL";scopeId:string|null;employmentStatus:"inactive";operationalReadiness:"unverified";fixture:true}>;
export type FinalizationResult={kind:"approved";receipt:Completed}|{kind:"rejected";registrationRequestId:string;reviewedVersion:number;reason:string}|{kind:"stale"|"denied"|"conflict"|"invalid"};
type Result=FinalizationResult;
export function validReviewedDossier(d:Dossier):boolean{const r=d.receipt;return !!r&&r.status==="REVIEWED_FOR_HO"&&r.registrationRequestId===d.id&&r.centerId===d.centerId&&!!d.centerId&&r.reviewedVersion===d.version&&Number.isSafeInteger(d.version)&&d.version>0&&!!r.reviewedBy.trim()&&!!d.name.trim()&&!!d.email.trim()&&d.documents.front&&d.documents.back;}
const receiptKey=(r:ReviewedDossierReceipt)=>JSON.stringify([r.registrationRequestId,r.centerId,r.status,r.reviewedVersion,r.reviewedBy]);
export function createFinalizationFixture(d:Dossier,roles:readonly RoleOption[],options:{identityConflict?:boolean|(()=>boolean);nextStaffId?:()=>string}={}){
 const dossier=structuredClone(d),catalog=structuredClone(roles);let decision:Result|null=null;
 const attempts=new Map<string,{fingerprint:string;result:Result}>();
 function finish(key:string,fingerprint:string,result:Result):Result{attempts.set(key,{fingerprint,result});if(result.kind==="approved"||result.kind==="rejected")decision=result;return structuredClone(result);}
 function prior(key:string,fingerprint:string):Result|null{const p=attempts.get(key);return p?p.fingerprint===fingerprint?structuredClone(p.result):{kind:"conflict"}:null;}
 return {dossier:()=>structuredClone(dossier),roles:()=>structuredClone(catalog),readback:()=>structuredClone(decision),
 finalize(request:FinalizeRequest):Result{
 const fingerprint=JSON.stringify([receiptKey(request.receipt),request.roleId,request.scopeType,request.scopeId]),cached=prior(request.key,fingerprint);if(cached)return cached;
 if(!request.key.trim())return {kind:"invalid"};if(decision)return {kind:"stale"};if(!validReviewedDossier(dossier)||!dossier.receipt||receiptKey(request.receipt)!==receiptKey(dossier.receipt))return {kind:"stale"};
 const role=catalog.find(r=>r.id===request.roleId&&r.active);
 if(!role||!role.scopes.includes(request.scopeType)||!((request.scopeType==="CENTER"&&request.scopeId===dossier.centerId)||(request.scopeType==="GLOBAL"&&request.scopeId===null)))return {kind:"denied"};
 if(typeof options.identityConflict==="function"?options.identityConflict():options.identityConflict)return {kind:"conflict"};
 return finish(request.key,fingerprint,{kind:"approved",receipt:{registrationRequestId:dossier.id,status:"APPROVED",reviewedVersion:dossier.version,personId:"HO-PERSON-MOCK-001",staffId:options.nextStaffId?.()??"HO-STAFF-MOCK-001",userId:"HO-USER-MOCK-001",roleId:role.id,scopeType:request.scopeType,scopeId:request.scopeId,employmentStatus:"inactive",operationalReadiness:"unverified",fixture:true}});
 },
 reject(receipt:ReviewedDossierReceipt,reason:string,key:string):Result{
 const fingerprint=JSON.stringify(["reject",receiptKey(receipt),reason.trim()]),cached=prior(key,fingerprint);if(cached)return cached;
 if(!key.trim()||!reason.trim()||reason.trim().length>500)return {kind:"invalid"};if(decision||!validReviewedDossier(dossier)||!dossier.receipt||receiptKey(receipt)!==receiptKey(dossier.receipt))return {kind:"stale"};
 return finish(key,fingerprint,{kind:"rejected",registrationRequestId:dossier.id,reviewedVersion:dossier.version,reason:reason.trim()});
 }};
}
export const reviewedDossierSeed:Dossier={id:"STAFF-DOSSIER-MOCK-001",version:1,name:"Ứng viên mẫu PINO",email:"applicant@example.invalid",mobile:null,centerId:"STAFF-MOCK-CENTER",documents:{front:true,back:true},receipt:{registrationRequestId:"STAFF-DOSSIER-MOCK-001",centerId:"STAFF-MOCK-CENTER",status:"REVIEWED_FOR_HO",reviewedVersion:1,reviewedBy:"M1 BO Reviewer"}};
export const finalizationRoleOptions:readonly RoleOption[]=[{id:"STAFF-MOCK-ROLE",label:"Staff (M1)",active:true,scopes:["CENTER"]}];
