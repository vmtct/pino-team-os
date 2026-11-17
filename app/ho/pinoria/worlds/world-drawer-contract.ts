/** PAP-2096 / PAP-8 PNR-WORLD — shared HO World Create/View contract.
 * No permission or transport admission here. The authorized host supplies the action.
 */
import type {BoField,BoModule,BoRecord,BoValue} from "@/lib/bo-registration";
const field=(key:string,label:string,type:BoField["type"]="text",w=150):BoField=>({key,label,type,w,icon:type==="number"?"#":"Aa",readonly:true});
export const worldTypes=["CORE","SUMMER","SPECIAL","OTHER"] as const;
export type WorldType=typeof worldTypes[number];
export const worldDrawerModule:BoModule={label:"Danh mục thế giới",group:"Pinoria",fields:[field("name","World","text",220),{...field("worldType","Loại","select"),options:[...worldTypes]},field("status","Trạng thái","select"),field("sceneCount","Số cảnh","number"),field("layerCount","Số lớp","number"),field("key","Key"),field("id","ID","id"),field("createdAt","Created Time","datetime",185),field("createdByUser","Created By","text",180),field("updatedAt","Last Modified Time","datetime",185),field("updatedByUser","Last Modified By","text",190)]};
const createKeys=new Set(["name","key","worldType"]);
export function worldCreateEditable(f:BoField):boolean{return createKeys.has(f.key);}
export const blankWorldDraft=():BoRecord=>({id:"",name:"",worldType:"CORE",key:"",status:"DRAFT",sceneCount:0,layerCount:0,createdAt:null,createdByUser:"—",updatedAt:null,updatedByUser:"—"});
export function setWorldDraft(d:BoRecord,key:string,value:BoValue):BoRecord{return createKeys.has(key)?{...d,[key]:value}:d;}
export type CreateWorldPayload={key:string;displayName:string;worldType:WorldType;descriptionText:string};
export function worldCreatePayload(d:BoRecord):CreateWorldPayload{
 const name=typeof d.name==="string"?d.name.trim():"",key=typeof d.key==="string"?d.key.trim().toLowerCase():"";
 if(!name||name.length>140)throw Error("Nhập tên World (tối đa 140 ký tự).");
 // Match stricter approved prototype key subset; Core permits additional characters/length.
 if(!/^[a-z0-9][a-z0-9-]{1,63}$/.test(key))throw Error("Key cần 2–64 ký tự thường, số hoặc gạch ngang.");
 const kind=d.worldType;if(typeof kind!=="string"||!worldTypes.includes(kind as WorldType))throw Error("Loại World không hợp lệ.");
 return {key,displayName:name,worldType:kind as WorldType,descriptionText:""};
}
export function assertWorldCreated(row:BoRecord,input:CreateWorldPayload):void{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id)||row.name!==input.displayName||row.key!==input.key||row.worldType!==input.worldType||row.status!=="DRAFT"||row.sceneCount!==0||row.layerCount!==0)throw Error("Chưa xác minh được World vừa tạo. Kiểm tra lại danh mục trước khi thử lại.");
}
