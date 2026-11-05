import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import {createBillsApi,draftTotal,type BillDraft} from "@/lib/bo-bills-api";
import type {BoBillSummary} from "@/lib/bo-model";

const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const P="billing.view";
export const billFields=[
 {key:"code",label:"Bill",type:"text",icon:"#",width:290,permission:P,readOnly:true,capabilities:read},
 {key:"status",label:"Trạng thái",type:"text",icon:"▤",width:150,permission:P,readOnly:true,capabilities:read},
 {key:"parent",label:"Phụ huynh (ID)",type:"text",icon:"@",width:280,permission:P,readOnly:true,capabilities:read},
 {key:"center",label:"Center",type:"text",icon:"▤",width:280,permission:P,readOnly:true,capabilities:read},
 {key:"total",label:"Tổng phải thu",type:"currency",icon:"#",width:170,permission:P,readOnly:true,capabilities:read},
 {key:"due",label:"Hạn thu",type:"text",icon:"▤",width:145,permission:P,readOnly:true,capabilities:read},
 {key:"note",label:"Ghi chú",type:"textarea",icon:"Aa",width:260,permission:P,readOnly:true,capabilities:read},
 {key:"lines",label:"Subscriptions · số lượng 1",type:"textarea",icon:"▤",width:300,permission:P,readOnly:true,capabilities:read},
 {key:"payments",label:"Thanh toán",type:"textarea",icon:"▤",width:300,permission:P,readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof billFields;
const sections=[{id:"bill",label:"Thông tin Bill",fields:["code","status","parent","center","total","due","note"]}] as const;
export const billQuery:TableQuery<F>={
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"code",direction:"asc"},group:null,
 order:["code","status","total","due","parent","center"],visible:["code","status","parent","total","due"],page:1,pageSize:15,
};
export const billDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"bills",label:"Bills",group:"TÀI CHÍNH",
 fields:billFields,capabilities:{read:P,create:"billing.manage"},
 actions:[{id:"create",label:"Tạo Bill",slot:"table.header",variant:"primary",capability:"create",handler:"bill.create"}],
 table:{
  identity:{field:"code",pinned:"left",hideable:false,reorderable:false},
  columns:[{field:"code",visible:true},{field:"status",visible:true},{field:"total",visible:true},{field:"due",visible:true},{field:"parent",visible:true},{field:"center",visible:false}],
  search:{fields:["code","status","parent","total","due"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["status"],mode:"flat",logic:"AND"},
  sort:{fields:["code","status","due"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["status"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[{id:"subscriptions",label:"Subscriptions",kind:"field-group",source:{adapter:"bill-lines",permission:P},sections:[{id:"lines",label:"Subscriptions",fields:["lines"]}]},{id:"payments",label:"Thanh toán",kind:"field-group",source:{adapter:"bill-payments",permission:P},sections:[{id:"payments",label:"Sổ thanh toán chỉ đọc",fields:["payments"]}]}],history:{kind:"unavailable",reason:"Lịch sử chỉ khả dụng khi API cung cấp cho Center hiện hành; không tạo event giả."}},
} as const satisfies SurfaceDefinition<F>;

export type BillRow=ModuleRow<F>;
export function projectBill(d:BillDraft,summary?:BoBillSummary):BillRow {
 return {id:d.id,code:d.issuedBillId??d.id,status:d.status==="DRAFT"?"Bản nháp":summary?.paymentState??"Đã phát hành",parent:d.payerParentUserId,center:d.centerId,total:summary?.netAmountMinor??draftTotal(d),due:d.dueOn??"?",note:d.note,
 lines:d.items.map(i=>`${i.descriptionSnapshot} · ${i.subscriptionId} · SL 1 · ${i.unitPriceMinor.toLocaleString("vi-VN")} ₫ · ${i.discountAmountMinor.toLocaleString("vi-VN")} ₫`).join("\n")||"Chưa có Subscription.",
 payments:d.status==="DRAFT"?"Bill chưa phát hành.":summary?`Đã thu: ${summary.collectedAmountMinor} ₫ ? Còn lại: ${summary.balanceMinor} ₫\n`+(summary.transactions.map(t=>`${t.occurredAt} · ${t.method} · ${t.transactionKind} · ${t.amountMinor} ₫ · ${t.status} · ${t.id}`).join("\n")||"Chưa có giao dịch."):"Mở chi tiết để tải sổ thanh toán."};
}
export const billProvider:SurfaceProvider<F>={pagination:"local-ui",
 async list(_q,scope,fetcher,signal){if(scope.surface!=="BO")throw Error("Center required");const rows=await createBillsApi(fetcher).list(scope.centerId,signal);return {records:rows.map(d=>({row:projectBill(d),centerId:scope.centerId,version:String(d.version)})),total:rows.length};},
 async detail(id,scope,fetcher,signal){
  if(scope.surface!=="BO")throw Error("Center required");const d=await createBillsApi(fetcher).get(scope.centerId,id,signal);
  let summary:BoBillSummary|undefined;
  if(d.issuedBillId){const response=await fetcher("/api/bo/billing/bills/"+d.issuedBillId,{cache:"no-store",signal});if(!response.ok)throw Error("Không thể tải sổ thanh toán ("+response.status+").");const raw=await response.json();summary=raw.data;if(!summary||summary.bill.id!==d.issuedBillId||summary.bill.payerParentUserId!==d.payerParentUserId||!Array.isArray(summary.transactions))throw Error("Sổ thanh toán không hợp lệ.");}
  return {row:projectBill(d,summary),centerId:scope.centerId,version:String(d.version)};
 }
};

const registry=new TddRegistry();
export const billSchema=registry.register({...billDefinition,data:{
 id:"bo-bills-center-bound",
 list:async()=>{throw Error("Authenticated BO Bills Center adapter required");},
 detail:async()=>{throw Error("Authenticated BO Bill detail adapter required");},
}});