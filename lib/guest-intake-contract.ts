/** PAP-2202 / PLT-GUEST — BO to Core intake boundary. No PII copied into guardian references. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type GuestCategory="ADULT"|"MINOR"|"UNKNOWN";
export type GuestRelationship="PARENT"|"GUARDIAN"|"OTHER";
export type GuestGuardianRef={parentUserId:string;relationship:GuestRelationship};
export type GuestGuardianProjection=GuestGuardianRef&{displayName:string|null;maskedPhone:string;phoneVerified:boolean};
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
export function guardianRef(v:unknown):v is GuestGuardianRef{
 return object(v)&&Object.keys(v).length===2&&typeof v.parentUserId==="string"&&UUID.test(v.parentUserId)&&(v.relationship==="PARENT"||v.relationship==="GUARDIAN"||v.relationship==="OTHER");
}
export function guardianProjection(v:unknown):v is GuestGuardianProjection{
 return object(v)&&Object.keys(v).length===5&&guardianRef({parentUserId:v.parentUserId,relationship:v.relationship})&&(v.displayName===null||typeof v.displayName==="string")&&typeof v.maskedPhone==="string"&&/[•*]/.test(v.maskedPhone)&&typeof v.phoneVerified==="boolean";
}
export function categoryLabel(v:unknown):string|null{
 if(v===undefined||v===null||v==="UNKNOWN")return "Chưa xác định";
 if(v==="ADULT")return "Người lớn";if(v==="MINOR")return "Trẻ em";return null;
}
export function categoryValue(v:unknown):"ADULT"|"MINOR"|null{
 return v==="Người lớn"?"ADULT":v==="Trẻ em"?"MINOR":null;
}
export function relationshipValue(v:string):GuestRelationship|null{return v==="Cha/mẹ"?"PARENT":v==="Người giám hộ"?"GUARDIAN":v==="Khác"?"OTHER":null;}
export function relationshipLabel(v:GuestRelationship):string{return v==="PARENT"?"Cha/mẹ":v==="GUARDIAN"?"Người giám hộ":"Khác";}
export function validIntakeBoundary(input:Record<string,unknown>,method:"POST"|"PATCH"):boolean{
 const profile=["name","gender","phone","birthDate","email","note"];
 const allowed=[...profile,"category","guardian",...(method==="PATCH"?["expectedVersion"]:[])];
 if(Object.keys(input).some(k=>!allowed.includes(k))||profile.some(k=>Object.hasOwn(input,k)&&input[k]!==null&&typeof input[k]!=="string"))return false;
 if(Object.hasOwn(input,"category")&&input.category!=="ADULT"&&input.category!=="MINOR")return false;
 if(Object.hasOwn(input,"guardian")&&input.guardian!==null&&!guardianRef(input.guardian))return false;
 if(input.category==="ADULT"&&input.guardian!=null)return false;
 if(input.category==="MINOR"&&Object.hasOwn(input,"guardian")&&input.guardian===null)return false;
 if(method==="PATCH")return Number.isSafeInteger(input.expectedVersion)&&Number(input.expectedVersion)>0&&Object.keys(input).some(k=>k!=="expectedVersion");
 // Preserve legacy exact replay at Core; missing classification is denied for fresh create by Core.
 return true;
}
