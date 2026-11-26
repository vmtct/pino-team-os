// PAP-2358 / PAP-2395: new Phase1 receipt only; old historical records are not current acceptance.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]):boolean{
  return Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
}
function canonical(value:unknown):value is string{return typeof value==="string"&&uuid.test(value);}
export type HoManualStaffReceipt={staffMemberId:string;personId:string;membershipId:string;centerId:string;initialStaffStatus:"inactive";accessState:"NOT_PROVISIONED"};
export function parseHoManualStaffReceipt(value:unknown,centerId:string,withLogin=false):HoManualStaffReceipt|null{
  const root=object(value),b=object(root?.data);
  const fields=["staffMemberId","personId","membershipId","centerId","initialStaffStatus","accessState"];
  if(withLogin||!root||!exactKeys(root,["data"])||!b||!exactKeys(b,fields)||
     b.centerId!==centerId||!canonical(centerId)||!canonical(b.staffMemberId)||!canonical(b.personId)||!canonical(b.membershipId)||
     b.initialStaffStatus!=="inactive"||b.accessState!=="NOT_PROVISIONED")return null;
  return {staffMemberId:b.staffMemberId,personId:b.personId,membershipId:b.membershipId,centerId,initialStaffStatus:"inactive",accessState:"NOT_PROVISIONED"};
}