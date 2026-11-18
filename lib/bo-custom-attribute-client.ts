/** PAP-1671 / PLT-ATTR. Strict client projection and CAS receipt, no capability inference. */
import {VALUE_TYPES,type ValueType} from "./ho-attribute-model";
import type {AttributeFieldProjection} from "./custom-attribute-projection";
export type NativeAttributeEntity="Student"|"Parent";
export type NativeAttributeValue=AttributeFieldProjection&{definitionRevision:number;valueRevision:number;valueId:string|null;updatedAt:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonical=(v:unknown):v is string=>typeof v==="string"&&uuid.test(v);
const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const revision=(v:unknown,min:number):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min;
const bad=():never=>{throw new Error("Dữ liệu thuộc tính không khớp phạm vi hoặc phiên bản.");};
function entityPath(entity:NativeAttributeEntity){if(entity==="Student")return "students";if(entity==="Parent")return "identity/parents";return bad();}
export function attributeValueUrl(entity:NativeAttributeEntity,entityId:string,centerId:string,definitionId?:string,after?:string):string{
 if(!canonical(entityId)||!canonical(centerId)||(definitionId!==undefined&&!canonical(definitionId))||(after!==undefined&&(!canonical(after)||definitionId!==undefined)))return bad();
 const p=new URLSearchParams({centerId});
 if(definitionId===undefined){p.set("limit","100");if(after)p.set("afterDefinitionId",after);}
 return "/api/bo/"+entityPath(entity)+"/"+entityId+"/custom-attributes"+(definitionId?"/"+definitionId:"")+"?"+p.toString();
}
export function parseAttributePage(raw:unknown,entity:NativeAttributeEntity,centerId:string):{items:NativeAttributeValue[];nextAfterDefinitionId:string|null}{
 if(!canonical(centerId)||!obj(raw)||!obj(raw.data)||raw.data.scopeCenterId!==centerId||!Array.isArray(raw.data.items)||raw.data.items.length>100)return bad();
 const seen=new Set<string>();const items:NativeAttributeValue[]=[];
 for(const v of raw.data.items as unknown[]){
  if(!obj(v)||!canonical(v.definitionId)||seen.has(v.definitionId)||v.entityType!==entity||
   !(v.scope==="GLOBAL"&&v.centerId===null||v.scope==="CENTER"&&v.centerId===centerId)||
   !Array.isArray(v.visibility)||!v.visibility.includes("BO")||typeof v.displayName!=="string"||!v.displayName.trim()||v.displayName.length>120||
   typeof v.valueType!=="string"||!(VALUE_TYPES as readonly string[]).includes(v.valueType)||
   typeof v.required!=="boolean"||typeof v.writable!=="boolean"||!revision(v.definitionRevision,1)||!revision(v.valueRevision,0)||
   !["ACTIVE","PILOT","ARCHIVED","DEPRECATED"].includes(String(v.status))||
   (v.writable&&v.status!=="ACTIVE"&&v.status!=="PILOT")||
   !Array.isArray(v.options)||v.options.length>50||!v.options.every((x:unknown)=>typeof x==="string"&&x.length>0&&x.length<=100)||
   new Set(v.options).size!==v.options.length||
   (v.valueType==="select"||v.valueType==="multiselect"?v.options.length===0:v.options.length!==0)||
   !(v.valueRevision===0?v.valueId===null&&v.value===null&&v.updatedAt===null:canonical(v.valueId)&&v.value!==null&&v.value!==undefined&&typeof v.updatedAt==="string"&&Number.isFinite(Date.parse(v.updatedAt))))return bad();
  seen.add(v.definitionId);
  items.push({id:v.definitionId,label:v.displayName,valueType:v.valueType as ValueType,options:v.options as string[],value:v.value,writable:v.writable,required:v.required,
   definitionRevision:v.definitionRevision,valueRevision:v.valueRevision,valueId:v.valueId as string|null,updatedAt:v.updatedAt as string|null});
 }
 const next=raw.data.nextAfterDefinitionId;
 if(next!==null&&(!canonical(next)||next!==items.at(-1)?.id||items.length!==100))return bad();
 return {items,nextAfterDefinitionId:next};
}
export function attributeValueCommand(item:NativeAttributeValue,value:unknown){
 if(!item.writable||!canonical(item.id)||!revision(item.definitionRevision,1)||!revision(item.valueRevision,0)||value===null||value===undefined)return bad();
 return {expectedDefinitionRevision:item.definitionRevision,expectedValueRevision:item.valueRevision,value};
}
export function parseAttributeReceipt(raw:unknown,item:NativeAttributeValue):{valueId:string;revision:number;definitionRevision:number;auditEventId:string}{
 if(!obj(raw)||!obj(raw.data))return bad();
 const d=raw.data;
 if(!canonical(d.valueId)||!canonical(d.auditEventId)||d.revision!==item.valueRevision+1||d.definitionRevision!==item.definitionRevision||(item.valueId!==null&&d.valueId!==item.valueId))return bad();
 return {valueId:d.valueId,revision:item.valueRevision+1,definitionRevision:item.definitionRevision,auditEventId:d.auditEventId};
}
/** Compare JSON domain values structurally; object key order is not value identity. */
function equalValue(left:unknown,right:unknown):boolean{
 if(left===right)return true;
 if(Array.isArray(left)&&Array.isArray(right))return left.length===right.length&&left.every((v:unknown,i)=>equalValue(v,right[i]));
 if(obj(left)&&obj(right)){
  const keys=Object.keys(left);return keys.length===Object.keys(right).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(right,k)&&equalValue(left[k],right[k]));
 }
 return false;
}
export function verifyAttributeReadback(items:readonly NativeAttributeValue[],target:NativeAttributeValue,receipt:ReturnType<typeof parseAttributeReceipt>,expected:unknown):void{
 const current=items.find(x=>x.id===target.id);
 if(!current||current.valueId!==receipt.valueId||current.valueRevision!==receipt.revision||current.definitionRevision!==receipt.definitionRevision||!equalValue(current.value,expected))bad();
}