import {type Approval,type FieldSchema,type ModuleRow,type TableQuery} from "@/lib/workspace-schema";
import type {SurfaceDefinition,SurfaceProvider} from "@/lib/workspace-adapters/contracts";
import {getItem,listItems,slotNames,type ItemRecord} from "./item-client";
const read={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const itemFields=[
 {key:"displayName",label:"Tên Item",type:"text",icon:"Aa",width:240,permission:"pinoria.item.view",readOnly:true,capabilities:read},
 {key:"key",label:"Item Key",type:"text",icon:"⌘",width:170,permission:"pinoria.item.view",readOnly:true,capabilities:read},
 {key:"type",label:"Loại",type:"text",icon:"▣",width:130,permission:"pinoria.item.view",readOnly:true,capabilities:read},
 {key:"slot",label:"Slot",type:"text",icon:"◈",width:180,permission:"pinoria.item.view",readOnly:true,capabilities:read},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:140,permission:"pinoria.item.view",readOnly:true,capabilities:read},
 {key:"revision",label:"Revision",type:"number",icon:"#",width:110,permission:"pinoria.item.view",readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof itemFields;
const sections=[{id:"item-definition",label:"Item Definition",fields:["displayName","key","type","slot","status","revision"]}] as const;
export const itemQuery:TableQuery<F>={search:"",filters:{logic:"AND",rules:[]},sort:{field:"displayName",direction:"asc"},
 group:null,order:["displayName","key","type","slot","status","revision"],visible:["displayName","type","slot","status","revision"],page:1,pageSize:15};
const extensionApproval={
 jira:"PAP-1119",owner:"Founder",designAuthority:"PAP-1109 V3.1 approved 2026-10-30",
 files:["app/components/pinoria-item/HoItemCalibration.tsx","app/ho/pinoria/wardrobe/HoItemsTdd.tsx","app/components/workspace-renderer/Slots.tsx"],
 tests:["lib/ho-pinoria-item-handler.test.ts","lib/workspace-renderer.test.ts"],
 reviewBy:"2026-11-30T00:00:00+07:00",
} as const;
const s2Approval={
 jira:"PAP-1253",owner:"Founder",designAuthority:"PAP-1253 i5 HO prototype approved 2026-10-31",
 files:["app/ho/pinoria/wardrobe/HoItemRelations.tsx","app/ho/pinoria/wardrobe/HoItemsTdd.tsx","app/ho/pinoria/wardrobe/schema.ts"],
 tests:["lib/pap1253-ho-item-s2.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00",
} as const;
export const itemDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"wardrobe",label:"Pinoria · Items",group:"Pinoria",
 fields:itemFields,capabilities:{read:"pinoria.item.view"},
 table:{
  identity:{field:"displayName",pinned:"left",hideable:false,reorderable:false},
  columns:[{field:"displayName",visible:true},{field:"key",visible:false},{field:"type",visible:true},{field:"slot",visible:true},{field:"status",visible:true},{field:"revision",visible:true}],
  search:{fields:["displayName","key","type","slot","status"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["displayName","key","type","slot","status","revision"],mode:"flat",logic:"AND"},
  sort:{fields:["displayName","key","type","slot","status","revision"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["type","slot","status"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{
  overview:{sections},
  businessTabs:[{id:"calibration",label:"Calibration",kind:"approved-extension",extensionId:"pap1119-ho-item-calibration-v1",
   source:{adapter:"pinoria.item.calibration",permission:"pinoria.item.view"},approval:extensionApproval},
   {id:"variants",label:"Biến thể",kind:"approved-extension",extensionId:"pap1253-ho-variant-v1",
   source:{adapter:"pinoria.item.variants",permission:"pinoria.item.view"},approval:s2Approval},
   {id:"members",label:"Thành viên",kind:"approved-extension",extensionId:"pap1253-ho-members-v1",
   source:{adapter:"pinoria.item.members",permission:"pinoria.item.view"},approval:s2Approval}],
  history:{kind:"unavailable",reason:"Lịch sử revision đã được Core ghi audit; API đọc lịch sử chưa được cấp cho HO S1."}
 }
} as const satisfies SurfaceDefinition<F>;
export const extensionVerifier=(approval:Approval,scope:{surface:"BO"|"HO";key:string;extensionId?:string})=>
 scope.surface==="HO"&&scope.key==="wardrobe"&&(
  (scope.extensionId==="pap1119-ho-item-calibration-v1"&&approval.jira==="PAP-1119"&&approval.designAuthority===extensionApproval.designAuthority&&approval.files.length===3&&approval.tests.length===2)||
  (["pap1253-ho-variant-v1","pap1253-ho-members-v1"].includes(scope.extensionId??"")&&approval.jira==="PAP-1253"&&approval.designAuthority===s2Approval.designAuthority&&approval.files.length===3&&approval.tests.length===1)
 );
const projection=(i:ItemRecord):ModuleRow<F>=>({
 id:i.id,displayName:i.displayName,key:i.key,type:i.type,slot:i.type==="SET"?"—":slotNames[i.slot],status:i.status,revision:i.revision
});
export const itemProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(_query,scope,_fetch,signal){if(scope.surface!=="HO")throw Error("HO only");
  const items=await listItems(signal);signal.throwIfAborted();return {records:items.map(i=>({row:projection(i)})),total:items.length};},
 async detail(id,scope,_fetch,signal){if(scope.surface!=="HO")throw Error("HO only");
  const item=await getItem(id,signal);signal.throwIfAborted();return {row:projection(item)};}
};
