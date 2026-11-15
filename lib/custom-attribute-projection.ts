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
type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
type JsonObject={[key:string]:JsonValue};
type SavedAttributeValue=string|number|boolean|string[]|JsonObject;
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function jsonTree(raw:unknown,depth:number,budget:{count:number},seen:Set<object>):boolean{
 if(++budget.count>1024||depth>16)return false;
 if(raw===null||typeof raw==="string"||typeof raw==="boolean")return true;
 if(typeof raw==="number")return Number.isFinite(raw);
 if(typeof raw!=="object"||seen.has(raw))return false;
 seen.add(raw);
 try{
  if(Array.isArray(raw)){
   if(raw.length>1024||Object.keys(raw).length!==raw.length||Object.getOwnPropertySymbols(raw).length)return false;
   for(let i=0;i<raw.length;i++){const d=Object.getOwnPropertyDescriptor(raw,String(i));if(!d||!("value" in d)||!jsonTree(d.value,depth+1,budget,seen))return false;}
   return true;
  }
  if(!plain(raw)||Object.getOwnPropertySymbols(raw).length)return false;
  return Object.keys(raw).every(k=>{
   if(["__proto__","constructor","prototype"].includes(k))return false;
   const d=Object.getOwnPropertyDescriptor(raw,k);
   return !!d&&"value" in d&&jsonTree(d.value,depth+1,budget,seen);
  });
 }finally{seen.delete(raw);}
}
function jsonText(raw:unknown):string|null {
 if(!plain(raw)||!jsonTree(raw,0,{count:0},new Set()))return null;
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
 const canEdit=writable===true&&valid;
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

/** PAP-1670: native editor plan, with explicit conversion before any future CAS command.
 * Empty/null is never implicitly saved as a default; no clear operation is defined here. */
type EditResult={ok:true;value:SavedAttributeValue}|{ok:false;error:string};
export type AttributeEditPlan={field:BoField;value:BoValue;parse:(draft:BoValue)=>EditResult};
const bad=():EditResult=>({ok:false,error:"Giá trị thuộc tính không hợp lệ."});
export function prepareAttributeEdit(input:AttributeFieldProjection):AttributeEditPlan|null {
 const p=projectAttribute(input);
 if(!p.canEdit)return null;
 const {valueType,required,options}=input;
 const field:BoField={...p.field,readonly:false};
 let value=p.value;
 if(valueType==="number"||valueType==="datetime"){
  field.type="text";value=value===null?null:String(value);
 }else if(valueType==="boolean"){
  field.type="select";field.options=["Có","Không"];value=value===null?null:value===true?"Có":"Không";
 }
 return {field,value,parse(draft){
  let raw:unknown=draft;
  if(valueType==="number"){
   if(typeof draft!=="string"||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(draft))return bad();
   raw=Number(draft);
  }else if(valueType==="boolean"){
   if(draft!=="Có"&&draft!=="Không")return bad();
   raw=draft==="Có";
  }else if(valueType==="json"){
   if(typeof draft!=="string"||new TextEncoder().encode(draft).byteLength>8192)return bad();
   try{raw=JSON.parse(draft) as unknown;}catch{return bad();}
  }
  if(raw===null||raw===undefined)return bad();
  if(valueType==="text"&&required&&typeof raw==="string"&&!raw.trim())return bad();
  if(valueType==="multiselect"&&required&&Array.isArray(raw)&&raw.length===0)return bad();
  if(valueType==="select"&&(typeof raw!=="string"||!options.includes(raw)))return bad();
  const result=projectAttribute({...input,value:raw});
  if(result.invalid||result.value===null)return bad();
  return {ok:true,value:raw as SavedAttributeValue};
 }};
}
