import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import {createBillsApi,type BillDraft} from "@/lib/bo-bills-api";
import {loadBoBillTable} from "@/lib/bo-bill-table-client";
import type {BillTableItem} from "@/lib/bo-bill-table-contract";
import {latestBillPayment,maskedBillIdentity,unavailableBillCode} from "@/lib/bill-table-presentation";
import type {BoBillSummary,BoSubscriptionDirectoryItem} from "@/lib/bo-model";

type Choice = Pick<BoSubscriptionDirectoryItem,"studentDisplayName"|"pathDisplayName"|"listPriceMinor">;

/** Show Student, program and actual list price; never output opaque IDs as presentation copy. */
export function billSubscriptionChoiceLabel(choice:Choice):string {
 const names=[choice.studentDisplayName.trim(),choice.pathDisplayName.trim()].filter(Boolean).join(" · ");
 const price=choice.listPriceMinor;
 if(typeof price!=="number"||!Number.isSafeInteger(price)||price<0)return names;
 return names+" · "+price.toLocaleString("vi-VN")+" ₫";
}

const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const P="billing.view";
export const billFields=[
 {key:"code",label:"Bill",type:"text",icon:"#",width:290,permission:P,readOnly:true,capabilities:read},
 {key:"status",label:"Trạng thái",type:"text",icon:"▤",width:150,permission:P,readOnly:true,capabilities:read},
 {key:"parent",label:"Phụ huynh",type:"text",icon:"@",width:280,permission:P,readOnly:true,capabilities:read},
 {key:"center",label:"Center",type:"text",icon:"▤",width:280,permission:P,readOnly:true,capabilities:read},
 {key:"total",label:"Tổng",type:"currency",icon:"#",width:170,permission:P,readOnly:true,capabilities:read},
 {key:"students",label:"Học viên",type:"text",icon:"Aa",width:190,permission:P,readOnly:true,capabilities:read},
 {key:"subscriptionCount",label:"Subscriptions",type:"number",icon:"#",width:140,permission:P,readOnly:true,capabilities:read},
 {key:"collected",label:"Đã thu",type:"currency",icon:"#",width:155,permission:P,readOnly:true,capabilities:read},
 {key:"balance",label:"Còn lại",type:"currency",icon:"#",width:155,permission:P,readOnly:true,capabilities:read},
 {key:"latestPaymentAt",label:"Ngày thu gần nhất",type:"datetime",icon:"Aa",width:170,permission:P,readOnly:true,capabilities:read},
 {key:"createdAt",label:"Ngày tạo",type:"datetime",icon:"Aa",width:150,permission:P,readOnly:true,capabilities:read},
 {key:"due",label:"Hạn thu",type:"text",icon:"▤",width:145,permission:P,readOnly:true,capabilities:read},
 {key:"note",label:"Ghi chú",type:"textarea",icon:"Aa",width:260,permission:P,readOnly:true,capabilities:read},
 {key:"lines",label:"Subscriptions · số lượng 1",type:"textarea",icon:"▤",width:300,permission:P,readOnly:true,capabilities:read},
 {key:"payments",label:"Thanh toán",type:"textarea",icon:"▤",width:300,permission:P,readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof billFields;
export const billTableColumns=["code","parent","students","subscriptionCount","total","collected","balance","status","latestPaymentAt","createdAt"] as const;
const sections=[{id:"bill",label:"Thông tin Bill",fields:[...billTableColumns,"center","due","note"]}] as const;
export const billQuery:TableQuery<F>={
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"createdAt",direction:"desc"},group:null,
 order:[...billTableColumns],visible:[...billTableColumns],page:1,pageSize:15,
};
export const billDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"bills",label:"Bills",group:"TÀI CHÍNH",
 fields:billFields,capabilities:{read:P,create:"billing.manage"},
 actions:[{id:"create",label:"Tạo Bill",slot:"table.header",variant:"primary",capability:"create",handler:"bill.create"}],
 table:{
  identity:{field:"code",pinned:"left",hideable:false,reorderable:false},
  columns:billTableColumns.map(field=>({field,visible:true})),
  search:{fields:["code","status","parent","students"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["status"],mode:"flat",logic:"AND"},
  sort:{fields:["code","status","createdAt","latestPaymentAt"],mode:"single",nulls:"last",tieBreak:"record-id"},
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
export function projectBillTable(d:BillTableItem):BillRow {
 // PII presentation is exclusively driven by Core VERIFIED/REDACTED per subject.
 // No client-side role, billing.view, or guardian inference is permitted.
 const parent=d.payerDisplay.state==="VERIFIED"?d.payerDisplay.label:maskedBillIdentity;
 const verifiedStudents=d.students.filter(student=>student.display.state==="VERIFIED");
 const students=verifiedStudents.length?
   d.students.map(student=>student.display.state==="VERIFIED"?student.display.label:maskedBillIdentity).join(", "):
   maskedBillIdentity;
 return {id:d.draftId,code:unavailableBillCode,parent,students,center:null,
 subscriptionCount:d.subscriptionLineCount,total:d.netAmountMinor,collected:d.collectedAmountMinor,balance:d.balanceMinor,
 status:d.status==="DRAFT"?"Bản nháp":d.status,latestPaymentAt:d.latestConfirmedPaymentAt,createdAt:d.createdAt,
 due:null,note:null,lines:"Mở chi tiết để xem Subscriptions.",payments:d.status==="DRAFT"?"Bill chưa phát hành.":"Mở chi tiết để tải sổ thanh toán."};
}
export function projectBill(d:BillDraft,summary?:BoBillSummary):BillRow {
 // The list contract is Draft-only. Issued finance/count/creation must never fall back to that snapshot.
 return {id:d.id,code:unavailableBillCode,status:d.status==="DRAFT"?"Bản nháp":summary?.paymentState??"Đã phát hành",
 parent:maskedBillIdentity,students:maskedBillIdentity,center:d.centerId,
 subscriptionCount:d.status==="DRAFT"?d.items.length:summary?.items.length??null,
 total:summary?.netAmountMinor??null,collected:summary?.collectedAmountMinor??null,balance:summary?.balanceMinor??null,
 latestPaymentAt:summary?latestBillPayment(summary.transactions):null,
 createdAt:d.createdAt,due:d.dueOn??null,note:d.note,
 lines:d.items.map(i=>`${i.descriptionSnapshot} · ${i.subscriptionId} · SL 1 · ${i.unitPriceMinor.toLocaleString("vi-VN")} ₫ · ${i.discountAmountMinor.toLocaleString("vi-VN")} ₫`).join("\n")||"Chưa có Subscription.",
 payments:d.status==="DRAFT"?"Bill chưa phát hành.":summary?`Đã thu: ${summary.collectedAmountMinor} ₫ ? Còn lại: ${summary.balanceMinor} ₫\n`+(summary.transactions.map(t=>`${t.occurredAt} · ${t.method} · ${t.transactionKind} · ${t.amountMinor} ₫ · ${t.status} · ${t.id}`).join("\n")||"Chưa có giao dịch."):"Mở chi tiết để tải sổ thanh toán."};
}
export const billProvider:SurfaceProvider<F>={pagination:"local-ui",
 async list(_q,scope,fetcher,signal){if(scope.surface!=="BO")throw Error("Center required");const rows=await loadBoBillTable(scope.centerId,fetcher,signal);return {records:rows.map(d=>({row:projectBillTable(d),centerId:scope.centerId,version:String(d.freshness.draftVersion)})),total:rows.length};},
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
