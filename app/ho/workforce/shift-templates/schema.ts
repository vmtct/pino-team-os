import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { parseHoShiftTemplates } from "@/lib/ho-shift-templates-read-facade";

const read = {display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const shiftTemplateFields = [
  {key:"displayLabel",label:"Mẫu ca",type:"text",icon:"Aa",width:240,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"code",label:"Mã",type:"text",icon:"#",width:140,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"startLocalTime",label:"Bắt đầu",type:"text",icon:"◷",width:120,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"endLocalTime",label:"Kết thúc",type:"text",icon:"◷",width:120,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:140,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"centerId",label:"Center",type:"text",icon:"⌖",width:240,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"updatedAt",label:"Cập nhật",type:"text",icon:"◷",width:220,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
  {key:"createdAt",label:"Đã tạo",type:"text",icon:"◷",width:220,permission:"workforce.shift_template.ho_manage",readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F = typeof shiftTemplateFields;
type Row = ModuleRow<F>;
const sections=[{id:"shift-template-information",label:"Thông tin",fields:["displayLabel","code","startLocalTime","endLocalTime","status","centerId","updatedAt","createdAt"]}] as const;
const tab = (id:"edit"|"status",label:string) => ({
  id,label,kind:"approved-extension" as const,
  source:{adapter:"ho-shift-template-"+id,permission:"workforce.shift_template.ho_manage"},
  extensionId:"ho.workforce.shift-template-"+id,
  approval:{
    jira:"PAP-1198",owner:"HO Runtime",designAuthority:"Founder",
    files:["app/ho/workforce/shift-templates/HoShiftTemplateEditor.tsx","app/ho/workforce/shift-templates/HoShiftTemplatesTdd.tsx"],
    tests:["lib/pap1198-ho-shift-templates-mutation.test.ts"],
    reviewBy:"2026-11-30T00:00:00+07:00",
  },
});
export const shiftTemplateQuery:TableQuery<F>={
  search:"",filters:{logic:"AND",rules:[]},sort:{field:"displayLabel",direction:"asc"},group:null,
  order:["displayLabel","code","startLocalTime","endLocalTime","status","centerId","updatedAt","createdAt"],
  visible:["displayLabel","code","startLocalTime","endLocalTime","status"],
  page:1,pageSize:15,
};
export const shiftTemplateDefinition={
  version:1,classification:"TDD_DEFAULT",surface:"HO",key:"shiftTemplates",label:"Mẫu ca",group:"Workforce",
  fields:shiftTemplateFields,capabilities:{read:"workforce.shift_template.ho_manage",create:"workforce.shift_template.ho_manage"},
  actions:[{id:"create-shift-template",label:"Tạo mẫu ca",slot:"table.header",variant:"primary",
    capability:"create",handler:"openCreate"}],
  table:{
    identity:{field:"displayLabel",pinned:"left",hideable:false,reorderable:false},
    columns:[{field:"displayLabel",visible:true},{field:"code",visible:true},{field:"startLocalTime",visible:true},
      {field:"endLocalTime",visible:true},{field:"status",visible:true},{field:"centerId",visible:false},
      {field:"updatedAt",visible:false},{field:"createdAt",visible:false}],
    search:{fields:["displayLabel","code"],normalization:"vi-diacritic-insensitive"},
    filters:{fields:["displayLabel","status","startLocalTime","endLocalTime"],mode:"flat",logic:"AND"},
    sort:{fields:["displayLabel","startLocalTime","code","status"],mode:"single",nulls:"last",tieBreak:"record-id"},
    group:{fields:["status"],mode:"single"},
    views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
    pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},
    interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",
      keyboard:"canonical",undo:"local-ui-only"},
  },
  drawer:{density:"one-column",sections,actions:[]},
  detail:{
    overview:{sections},
    businessTabs:[tab("edit","Chỉnh sửa"),tab("status","Trạng thái")],
    history:{kind:"unavailable",reason:"Lịch sử Mẫu ca yêu cầu audit Core được phân quyền; không dùng dữ liệu giả."},
  },
} as const satisfies SurfaceDefinition<F>;

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function readShiftTemplates(centerId:string,fetcher:typeof fetch,signal:AbortSignal):Promise<readonly Row[]> {
  if(!uuid.test(centerId))throw Error("Cần chọn Center hợp lệ.");
  const url="/api/ho/workforce/shift-templates?centerId="+encodeURIComponent(centerId);
  const response=await fetcher(url,{method:"GET",signal,cache:"no-store",credentials:"same-origin"});
  signal.throwIfAborted();
  if(!response.ok)throw Error(response.status===403?"Không có quyền quản lý Mẫu ca.":"Không tải được Mẫu ca từ Core.");
  const body:unknown=await response.json();
  signal.throwIfAborted();
  const parsed=parseHoShiftTemplates(body,centerId);
  if(!parsed)throw Error("Core trả dữ liệu Mẫu ca không hợp lệ.");
  return parsed.map(r=>({
    id:r.id,displayLabel:r.displayLabel,code:r.code,startLocalTime:r.startLocalTime,
    endLocalTime:r.endLocalTime,status:r.status,centerId:r.centerId,updatedAt:r.updatedAt,createdAt:r.createdAt,
  }));
}
export function createShiftTemplateProvider(centerId:string):SurfaceProvider<F> {
  return {
    pagination:"local-ui",
    async list(_query,scope,fetcher,signal) {
      if(scope.surface!=="HO")throw Error("HO only");
      const rows=await readShiftTemplates(centerId,fetcher,signal);
      return {records:rows.map(row=>({row})),total:rows.length};
    },
    async detail(id,scope,fetcher,signal) {
      if(scope.surface!=="HO")throw Error("HO only");
      const rows=await readShiftTemplates(centerId,fetcher,signal);
      const row=rows.find(r=>r.id===id);
      return row?{row}:null;
    },
  };
}
export const verifyShiftTemplateExtensionApproval:ApprovalVerifier=(approval,scope)=>
  scope.surface==="HO" && scope.key==="shiftTemplates" &&
  ["ho.workforce.shift-template-edit","ho.workforce.shift-template-status"].includes(scope.extensionId??"") &&
  approval.jira==="PAP-1198" && approval.owner==="HO Runtime" && approval.designAuthority==="Founder" &&
  approval.files.includes("app/ho/workforce/shift-templates/HoShiftTemplateEditor.tsx");
export const shiftTemplateRegistry=new TddRegistry(verifyShiftTemplateExtensionApproval);
export const shiftTemplateSchema=shiftTemplateRegistry.register({
  ...shiftTemplateDefinition,
  data:{
    id:"ho-shift-templates-center-read",
    list:async(_query:TableQuery<F>,_context,_signal)=>{throw Error("Explicit Center-bound SurfaceProvider is required.");},
    detail:async(_id:string,_context,_signal)=>{throw Error("Explicit Center-bound SurfaceProvider is required.");},
  },
});
