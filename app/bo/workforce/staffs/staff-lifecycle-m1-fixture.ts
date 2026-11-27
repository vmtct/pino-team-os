import type {BoStaffProfile,BoStaffProfilePatch,BoStaffRegistrationApprovalResult} from "@/lib/bo-model";
import {STAFF_DIRECTORY_MOCK_ID,staffDirectoryFixture} from "./staff-directory-m1-fixture";
type Phase="pending"|"approved"|"rejected";
export type StaffLifecycleSnapshot={phase:Phase;revision:number;profile:BoStaffProfile|null;accountState:"UNKNOWN";operationalReadiness:"NOT_READY"|"NOT_VERIFIED"};
export type StaffOperationalProfileField="displayLabel"|"employmentType"|"department"|"startDate"; const fields=new Set<string>(["displayLabel","employmentType","department","startDate"]);
/** PAP-2411: isolated local lifecycle only; never a live command or authorization provider. */
export function createStaffLifecycleM1Fixture(initial:"pending"|"approved"="approved"){
 const seed=staffDirectoryFixture();
 const profile:BoStaffProfile={id:STAFF_DIRECTORY_MOCK_ID,displayLabel:String(seed.name),status:"active",department:String(seed.department),roleLabel:String(seed.role),email:"staff@example.invalid",mobile:null,employmentType:null,startDate:null};
 let phase:Phase=initial,revision=1,record:BoStaffProfile|null=initial==="approved"?profile:null;
 const snapshot=():StaffLifecycleSnapshot=>structuredClone({phase,revision,profile:record,accountState:"UNKNOWN",operationalReadiness:record?.status==="active"?"NOT_VERIFIED":"NOT_READY"});
 const requireCurrent=(id:string,expectedRevision:number)=>{if(id!==STAFF_DIRECTORY_MOCK_ID||!record||phase!=="approved"||expectedRevision!==revision)throw Error("Stale or unknown fixture Staff");return record;};
 return {
  snapshot,
  rows:()=>record?[{...seed,name:record.displayLabel,status:record.status,department:record.department,role:record.roleLabel}]:[],
  approve(receipt:BoStaffRegistrationApprovalResult){if(phase!=="pending"||receipt.registrationRequestId!==STAFF_DIRECTORY_MOCK_ID||receipt.staffMemberId!==STAFF_DIRECTORY_MOCK_ID||receipt.status!=="APPROVED")throw Error("Invalid fixture approval receipt");phase="approved";record={...profile};revision++;return snapshot();},
  reject(id:string){if(id!==STAFF_DIRECTORY_MOCK_ID||phase!=="pending")throw Error("Invalid fixture rejection");phase="rejected";revision++;return snapshot();},
  edit(id:string,expectedRevision:number,patch:BoStaffProfilePatch){const current=requireCurrent(id,expectedRevision);if(!Object.keys(patch).length||Object.keys(patch).some(k=>!fields.has(k))||Object.values(patch).some(v=>v!==null&&typeof v!=="string")||(patch.displayLabel!==undefined&&!patch.displayLabel.trim()))throw Error("Invalid fixture profile patch");if(patch.startDate!=null&&(!/^\d{4}-\d{2}-\d{2}$/.test(patch.startDate)||!Number.isFinite(Date.parse(patch.startDate))||new Date(patch.startDate).toISOString().slice(0,10)!==patch.startDate))throw Error("Invalid fixture start date");record={...current,...patch};revision++;return snapshot();},
  deactivate(id:string,expectedRevision:number,confirmed:boolean){const current=requireCurrent(id,expectedRevision);if(!confirmed||current.status!=="active")throw Error("Explicit active Staff confirmation required");record={...current,status:"inactive"};revision++;return snapshot();},
 };
}

export type StaffLifecycleM1Fixture=ReturnType<typeof createStaffLifecycleM1Fixture>;
