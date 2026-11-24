// PAP-2192: pure metadata command/readback contract. No transport or authority grant.
type MetadataSnapshot = {
  id:string; roleKey:string; roleType:"custom"; status:"active";
  displayName:string; description:string|null; permissionKeys:string[]; updatedAt:string;
};
export type MetadataEditCommand = {
  roleId:string; roleKey:string;
  body:{displayName:string; description:string|null; permissionKeys:string[]; expectedUpdatedAt:string};
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const permission=/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const record=(v:unknown):v is Record<string,unknown> => !!v && typeof v==="object" && !Array.isArray(v);
const version=(v:unknown):v is string => typeof v==="string" && v.length<=48 && Number.isFinite(Date.parse(v));
const name=(v:unknown):v is string => typeof v==="string" && !!v.trim() && v.trim().length<=120;
const description=(v:unknown):v is string|null => v===null || typeof v==="string" && v.trim().length<=500;
const keys=(v:unknown):v is string[] => Array.isArray(v) && v.length<=500 &&
  v.every(k=>typeof k==="string"&&permission.test(k)) && new Set(v).size===v.length;
function snapshot(value:unknown):MetadataSnapshot|null {
  if(!record(value) || typeof value.id!=="string" || !uuid.test(value.id) ||
    typeof value.roleKey!=="string" || !value.roleKey.trim() || value.roleKey.toLowerCase()==="founder" ||
    value.roleType!=="custom" || value.status!=="active" || !name(value.displayName) ||
    !description(value.description) || !keys(value.permissionKeys) || !version(value.updatedAt))return null;
  // The existing update facade normalizes all metadata; reject an ambiguous legacy
  // snapshot instead of silently changing a field that the operator did not edit.
  if(value.displayName!==value.displayName.trim() ||
     (typeof value.description==="string" && (!value.description || value.description!==value.description.trim())))return null;
  return {id:value.id,roleKey:value.roleKey,roleType:"custom",status:"active",
    displayName:value.displayName,description:value.description,permissionKeys:[...value.permissionKeys].sort(),updatedAt:value.updatedAt};
}
export function prepareRoleMetadataEdit(current:unknown, expectedVersion:string, patch:unknown):MetadataEditCommand|null {
  const role=snapshot(current);
  if(!role || role.updatedAt!==expectedVersion || !record(patch))return null;
  const fields=Object.keys(patch);
  if(!fields.length || fields.some(k=>k!=="name"&&k!=="description"))return null;
  if(fields.some(k=>typeof patch[k]!=="string"))return null;
  const nextName=fields.includes("name")?(patch.name as string).trim():role.displayName;
  const nextDescription=fields.includes("description")?(patch.description as string).trim()||null:role.description;
  if(!name(nextName)||!description(nextDescription)||
    (nextName===role.displayName&&nextDescription===role.description))return null;
  return {roleId:role.id,roleKey:role.roleKey,body:{displayName:nextName,description:nextDescription,
    permissionKeys:role.permissionKeys,expectedUpdatedAt:role.updatedAt}};
}
export function verifyRoleMetadataEdit(command:MetadataEditCommand,receipt:unknown):boolean {
  const actual=snapshot(receipt);
  return actual!==null && record(receipt) && actual.id===command.roleId && actual.roleKey===command.roleKey &&
    actual.displayName===command.body.displayName && actual.description===command.body.description &&
    Date.parse(actual.updatedAt)>Date.parse(command.body.expectedUpdatedAt) &&
    JSON.stringify(actual.permissionKeys)===JSON.stringify([...command.body.permissionKeys].sort()) &&
    receipt.permissionCount===actual.permissionKeys.length &&
    typeof receipt.assignmentCount==="number" && Number.isSafeInteger(receipt.assignmentCount) && receipt.assignmentCount>=0;
}
