/** PAP-1841 / Epic PAP-1665 PLT-ATTR FSG3 — Core-owned bounded table query. */
import { ENTITY_TYPES, type AttributeDefinition, type Scope } from "./ho-attribute-model";
export const ATTRIBUTE_SORTS=["createdAt","updatedAt","displayName","attributeKey","entityType",
 "valueType","scope","center","lifecycleState","required","revision"] as const;
export type AttributeSort=typeof ATTRIBUTE_SORTS[number];
export const ATTRIBUTE_STATUSES=["DRAFT","PILOT","ACTIVE","DEPRECATED","ARCHIVED"] as const;
export type AttributeStatus=typeof ATTRIBUTE_STATUSES[number];
export interface AttributeTableRequest {
 limit:number;offset:number;sort:AttributeSort;order:"asc"|"desc";
 search?:string;entityType?:string;status?:AttributeStatus;scope?:Scope;centerId?:string;
}
export type AttributePage={items:AttributeDefinition[];total:number;limit:number;offset:number};
const centerPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const allow=new Set(["limit","offset","sort","order","search","entityType","status","scope","centerId"]);
const containsControl=(value:string)=>[...value].some(char=>{const c=char.codePointAt(0)??0;return c<32||c===127;});
const oneOf=(value:string,values:readonly string[])=>values.includes(value);
export function validateAttributeDirectoryParams(q:URLSearchParams):boolean {
 for(const key of q.keys())if(!allow.has(key)||q.getAll(key).length!==1)return false;
 const limit=q.get("limit"),offset=q.get("offset");
 if(limit!==null&&(!/^\d{1,2}$/.test(limit)||Number(limit)<1||Number(limit)>50))return false;
 if(offset!==null&&(!/^\d{1,5}$/.test(offset)||Number(offset)>10000))return false;
 const sort=q.get("sort");
 if(sort!==null&&!oneOf(sort,ATTRIBUTE_SORTS))return false;
 const order=q.get("order");
 if(order!==null&&order!=="asc"&&order!=="desc")return false;
 const search=q.get("search");
 if(search!==null&&(search!==search.trim()||search.length<1||search.length>120||containsControl(search)))return false;
 const entityType=q.get("entityType");
 if(entityType!==null&&!oneOf(entityType,ENTITY_TYPES))return false;
 const status=q.get("status");
 if(status!==null&&!oneOf(status,ATTRIBUTE_STATUSES))return false;
 const scope=q.get("scope");
 if(scope!==null&&scope!=="GLOBAL"&&scope!=="CENTER")return false;
 const centerId=q.get("centerId");
 if(centerId!==null&&!centerPattern.test(centerId))return false;
 return true;
}
/** Single mapping of the UI state to the authenticated Core query; no client filtering/paging. */
export function encodeAttributeDirectoryQuery(request:AttributeTableRequest):URLSearchParams {
 const q=new URLSearchParams([
  ["limit",String(request.limit)],["offset",String(request.offset)],
  ["sort",request.sort],["order",request.order]
 ]);
 const search=request.search?.trim();
 if(search)q.set("search",search);
 if(request.entityType)q.set("entityType",request.entityType);
 if(request.status)q.set("status",request.status);
 if(request.scope)q.set("scope",request.scope);
 if(request.centerId)q.set("centerId",request.centerId);
 if(!validateAttributeDirectoryParams(q))throw Error("Invalid server attribute directory query or sort");
 return q;
}
/** No fallback to items.length: incomplete/invalid Core response cannot invent counts. */
export function parseAttributePage(value:unknown,limit:number,offset:number):AttributePage {
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Core page invalid");
 const v=value as Record<string,unknown>;
 if(!Number.isSafeInteger(v.total)||typeof v.total!=="number"||v.total<0)
  throw Error("Core total missing or invalid");
 if(v.limit!==limit||v.offset!==offset||!Array.isArray(v.items)||v.items.length>limit||
    v.items.length>v.total)throw Error("Core page count/offset invalid");
 const valid=v.items.every(item=>item&&typeof item==="object"&&
   typeof item.id==="string"&&typeof item.displayName==="string"&&
   typeof item.attributeKey==="string"&&Number.isInteger(item.revision));
 if(!valid)throw Error("Core attribute rows invalid");
 return {items:v.items as AttributeDefinition[],total:v.total,limit,offset};
}
