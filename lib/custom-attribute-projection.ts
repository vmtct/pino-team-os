/** PAP-1670 / PAP-1665 — projection for shared native DSA property rows.
 * Only server-admitted metadata/value projections may be passed by a future consumer.
 * No permission inference, API, default materialization or entity-specific dependency. */
import type { BoField, BoRecord, BoValue } from "./bo-registration";
import type { ValueType } from "./ho-attribute-model";

export type AttributeFieldProjection = {
 id:string; label:string; valueType:ValueType; options:readonly string[];
 value:unknown; writable:boolean; required:boolean;
};
export type ProjectedAttribute = {
 field:BoField; value:BoValue; canEdit:boolean; invalid:boolean;
};
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!s.startsWith("0000")&&
 Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const validDatetime=(s:string)=>{
 const m=/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(s);
 return !!m&&validDate(m[1]!)&&Number.isFinite(Date.parse(s));
};
const bytes=(x:unknown)=>new TextEncoder().encode(JSON.stringify(x)).byteLength;
function jsonText(raw:unknown):string|null {
 if(raw===null||typeof raw!=="object"||Array.isArray(raw))return null;
 try{
  const s=JSON.stringify(raw);
  return typeof s==="string"&&bytes(raw)<=8192?s:null;
 }catch{return null;}
}
export function projectAttribute(input:AttributeFieldProjection):ProjectedAttribute {
 const {id,label,valueType,options,value,writable}=input;
 const type:BoField["type"]=valueType==="json"?"textarea":valueType;
 const field:BoField={key:"attribute:"+id,label,type,icon:"▦",w:180,
  ...(valueType==="select"||valueType==="multiselect"?{options:[...options]}:{})};
 let valid=true,projected:BoValue=null;
 // Null/undefined means no value, not a false, zero or implicit default.
 if(value!==undefined&&value!==null){
  switch(valueType){
   case "text":valid=typeof value==="string";if(valid)projected=value as string;break;
   case "number":valid=typeof value==="number"&&Number.isFinite(value);if(valid)projected=value as number;break;
   case "boolean":valid=typeof value==="boolean";if(valid)projected=value as boolean;break;
   case "date":valid=typeof value==="string"&&validDate(value);if(valid)projected=value as string;break;
   case "datetime":valid=typeof value==="string"&&validDatetime(value);if(valid)projected=value as string;break;
   case "select":valid=typeof value==="string"&&options.includes(value);if(valid)projected=value as string;break;
   case "multiselect":valid=Array.isArray(value)&&value.length<=50&&Object.keys(value).length===value.length&&new Set(value).size===value.length&&value.every((x:unknown)=>typeof x==="string"&&options.includes(x));if(valid)projected=[...value as string[]];break;
   case "json":projected=jsonText(value);valid=projected!==null;break;
   default:valid=false;
  }
  if(valid&&bytes(projected)>8192)valid=false;
 }
 // Existing BoTypedEditor cannot faithfully edit arbitrary signed decimals,
 // explicit-offset timestamps or structured JSON. Keep those read-only for now.
 const editorCompatible=!(["number","datetime","json"] as ValueType[]).includes(valueType);
 const canEdit=writable===true&&valid&&editorCompatible;
 return {field:{...field,readonly:!canEdit},value:valid?projected:null,canEdit,invalid:!valid};
}
export function projectAttributeRows(items:readonly AttributeFieldProjection[]):{
 fields:BoField[];record:BoRecord;editable:Set<string>;invalid:string[];
}{
 const fields:BoField[]=[],record:BoRecord={id:"",name:""},editable=new Set<string>(),invalid:string[]=[];
 const seen=new Set<string>();
 for(const input of items){
  if(seen.has(input.id))throw new Error("Duplicate attribute definition");
  seen.add(input.id);
  const p=projectAttribute(input);fields.push(p.field);record[p.field.key]=p.value;
  if(p.canEdit)editable.add(p.field.key);if(p.invalid)invalid.push(input.label);
 }
 return {fields,record,editable,invalid};
}
