// PAP-2358: pure shared receipt contract, no server auth imports.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function object(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]):boolean{
  return Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
}
function canonical(value:unknown):value is string{return typeof value==="string"&&uuid.test(value);}
export type HoManualStaffReceipt={staffMemberId:string;personId:string;membershipId:string;centerId:string;accessState:"NOT_PROVISIONED"}
  |{staffMemberId:string;personId:string;membershipId:string;centerId:string;accessState:"PROVISIONED";accessUserId:string;assignmentId:string};
export function parseHoManualStaffReceipt(value:unknown,centerId:string,withLogin:boolean):HoManualStaffReceipt|null{
  const root=object(value),b=object(root?.data);
  const fields=["staffMemberId","personId","membershipId","centerId","accessState"];
  if(!b||!exactKeys(b,withLogin?[...fields,"accessUserId","assignmentId"]:fields)||
     b.centerId!==centerId||!canonical(b.staffMemberId)||!canonical(b.personId)||!canonical(b.membershipId))return null;
  const result={staffMemberId:b.staffMemberId,personId:b.personId,membershipId:b.membershipId,centerId};
  if(!withLogin&&b.accessState==="NOT_PROVISIONED")return {...result,accessState:"NOT_PROVISIONED"};
  if(withLogin&&b.accessState==="PROVISIONED"&&canonical(b.accessUserId)&&canonical(b.assignmentId))
    return {...result,accessState:"PROVISIONED",accessUserId:b.accessUserId,assignmentId:b.assignmentId};
  return null;
}
