// PAP-2423 / PAP-2411: read-only projection of PAP-1063 compensation contract.
import type {BoStaffCompensationEntry} from "@/lib/bo-model";
import {verifiedCompensationRows} from "@/lib/bo-payroll-income-read";
import {STAFF_DIRECTORY_MOCK_ID} from "./staff-directory-m1-fixture";
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function currentStaffRate(rows:BoStaffCompensationEntry[]|null,staffId:string,asOf:string):BoStaffCompensationEntry|null{
 if(!rows||!staffId||!validDate(asOf))return null;
 try{
  const checked=verifiedCompensationRows(rows,staffId);
  if(checked.some(r=>!validDate(r.effectiveFrom)||(r.periodUntilExclusive!==null&&(!validDate(r.periodUntilExclusive)||r.periodUntilExclusive<=r.effectiveFrom))))return null;
  const current=checked.filter(r=>r.state==="CURRENT");
  const effective=checked.filter(r=>r.effectiveFrom<=asOf&&(r.periodUntilExclusive===null||r.periodUntilExclusive>asOf));
  return current.length===1&&effective.length===1&&current[0]===effective[0]?current[0]!:null;
 }catch{return null;}
}
export const staffRateReviewDate="2026-11-28";
export function staffRateReviewRows(id:string):BoStaffCompensationEntry[]|null{
 if(id!==STAFF_DIRECTORY_MOCK_ID)return null;
 return [
  {id:"M1-RATE-OLD",staffMemberId:id,effectiveFrom:"2026-10-01",periodUntilExclusive:"2026-11-01",state:"HISTORICAL",amountMinor:32000,currency:"VND",note:null,version:1,updatedAt:"2026-10-01T00:00:00Z"},
  {id:"M1-RATE-NOW",staffMemberId:id,effectiveFrom:"2026-11-01",periodUntilExclusive:"2026-12-01",state:"CURRENT",amountMinor:36000,currency:"VND",note:null,version:1,updatedAt:"2026-11-01T00:00:00Z"},
  {id:"M1-RATE-FUTURE",staffMemberId:id,effectiveFrom:"2026-12-01",periodUntilExclusive:null,state:"SCHEDULED",amountMinor:48000,currency:"VND",note:null,version:1,updatedAt:"2026-11-26T00:00:00Z"}
 ];
}
