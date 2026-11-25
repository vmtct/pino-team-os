/** PAP-1247: bounded, unmounted domain command declaration. This is not an
 * authorization decision, transport, generic MutationAdapter, or permission grant. */
export const ROLE_METADATA_COMMAND = Object.freeze({
  surface:"HO", moduleKey:"roles", command:"roles.metadata",
  permission:"access.role.edit", fields:Object.freeze(["name","description"] as const),
} as const);
type RoleField = typeof ROLE_METADATA_COMMAND.fields[number];
export type RoleInlinePatch = Readonly<Partial<Record<RoleField,string>>>;
export type RoleInlineRequest = Readonly<{id:string;expectedVersion:string;patch:RoleInlinePatch}>;
type Definition = {
  surface:string;key:string;
  capabilities:{read:string;edit?:string};
  fields:readonly {key:string;type:string;permission:string;readOnly:boolean;capabilities:{display:boolean;inlineEdit:boolean}}[];
  table:{inlineEdit:{enabled:boolean;fields:readonly string[]}};
};
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const roleField=(key:string):key is RoleField=>key==="name"||key==="description";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const instant=(v:unknown):v is string=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;

/** Only an exact declared compatibility consumer can later be bound by the keeper.
 * The existing read-only HO coordinator remains unchanged. */
export function matchesRoleInlineDeclaration(definition:Definition,declaration:unknown,hasGenericMutation:boolean):boolean {
  if(hasGenericMutation||definition.surface!=="HO"||definition.key!=="roles"||
    definition.capabilities.read!=="access.role.view"||definition.capabilities.edit!=="access.role.edit"||
    !isRecord(declaration)||!exact(declaration,["surface","moduleKey","command","permission","fields"])||
    declaration.surface!=="HO"||declaration.moduleKey!=="roles"||declaration.command!=="roles.metadata"||
    declaration.permission!=="access.role.edit"||!Array.isArray(declaration.fields)||
    declaration.fields.length!==2||declaration.fields[0]!=="name"||declaration.fields[1]!=="description")return false;
  const editable=definition.fields.filter(f=>f.capabilities.inlineEdit);
  if(editable.length!==2||new Set(definition.fields.map(f=>f.key)).size!==definition.fields.length||
    !ROLE_METADATA_COMMAND.fields.every(key=>editable.some(f=>f.key===key&&f.type===(key==="name"?"text":"textarea")&&
      !f.readOnly&&f.permission==="access.role.view"&&f.capabilities.display)))return false;
  const table=definition.table.inlineEdit;
  return table.enabled===(table.fields.length>0)&&new Set(table.fields).size===table.fields.length&&
    table.fields.every(roleField);
}

/** Parse an exact identity/version/field patch, without ever accepting a URL,
 * permission keys, role status, assignment, actor, arbitrary handler or scope. */
export function parseRoleInlineRequest(value:unknown):RoleInlineRequest|null {
  if(!isRecord(value)||!exact(value,["id","expectedVersion","patch"])||
    typeof value.id!=="string"||!uuid.test(value.id)||!instant(value.expectedVersion)||!isRecord(value.patch))return null;
  const fields=Object.keys(value.patch);
  if(!fields.length||fields.some(k=>!roleField(k)))return null;
  const patch:Partial<Record<RoleField,string>>={};
  for(const field of fields){
    if(!roleField(field))return null;
    const input=value.patch[field];
    if(typeof input!=="string")return null;
    const normalized=input.trim();
    if(field==="name"?(!normalized||normalized.length>120):normalized.length>500)return null;
    patch[field]=normalized;
  }
  return Object.freeze({id:value.id,expectedVersion:value.expectedVersion,patch:Object.freeze(patch)});
}

/** Pure presentation selection only. Never an authorization decision or a
 * write binding. A directory row without the exact reviewed version cannot
 * produce an editor selection, even when its metadata is readable. */
export function roleInlineSelection(input:unknown):Readonly<{id:string;expectedVersion:string;field:RoleField}>|null {
 if(!isRecord(input)||!exact(input,["host","surface","moduleKey","canRead","canEdit","row","version","field"])||
    input.surface!=="HO"||input.moduleKey!=="roles"||input.canRead!==true||input.canEdit!==true||
    (input.host!=="table"&&input.host!=="drawer")||typeof input.field!=="string"||!roleField(input.field)||
    (input.host==="table"&&input.field!=="name")||!instant(input.version)||!isRecord(input.row))return null;
 const row=input.row;
 if(typeof row.id!=="string"||!uuid.test(row.id)||row.roleType!=="custom"||row.status!=="active"||
    typeof row.roleKey!=="string"||!row.roleKey.trim()||row.roleKey.trim().toLowerCase()==="founder"||
    row.updatedAt!==input.version||typeof row[input.field]!=="string")return null;
 const value=row[input.field] as string;
 if(value!==value.trim()||(input.field==="name"?(!value||value.length>120):value.length>500))return null;
 return Object.freeze({id:row.id,expectedVersion:input.version,field:input.field});
}
