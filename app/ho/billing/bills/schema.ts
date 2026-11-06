import { TddRegistry, type Approval, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { loadBill, loadBills } from "@/lib/ho-bills-client";
import type { HoBill } from "@/lib/ho-bills-contract";
import {latestBillPayment,maskedBillIdentity,unavailableBillCode} from "@/lib/bill-table-presentation";
// Shell presentation permission only. Every financial request requires live Founder authorization in Core.
const permission = "team.bo.access";
const read = {display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false} as const;
const field = <K extends string>(key: K, label: string, width: number) => ({key,label,width,type:"text",icon:"Aa",permission,readOnly:true,capabilities:read} as const);
export const billFields = [field("name","Bill",175),field("payer","Phụ huynh",190),field("students","Học viên",190),field("center","Center",170),
  field("subscriptionCount","Subscriptions",140),field("totalView","Tổng",160),field("paidView","Đã thu",155),
  field("balanceView","Còn lại",155),field("status","Trạng thái",130),field("latestPaymentAt","Ngày thu gần nhất",170),field("createdAt","Ngày tạo",135)] as const satisfies readonly FieldSchema[];
type F = typeof billFields;
const keys = billFields.map(f => f.key);
const sections = [{id:"bill",label:"Thông tin Bill",fields:keys}];
export const billQuery: TableQuery<F> = {search:"",filters:{logic:"AND",rules:[]},sort:{field:"createdAt",direction:"desc"},
  group:null,order:keys,visible:keys,page:1,pageSize:15};
export const billApproval = {jira:"PAP-1422", owner:"Founder", designAuthority:"PAP-1362 v1.3 / approved i5 HO Bills PAP-1414",
  files:["app/ho/billing/bills/HoBillsTdd.tsx","app/ho/billing/bills/BillDomain.tsx"],
  tests:["lib/pap1422-ho-bills.test.ts"], reviewBy:"2026-11-30T00:00:00+07:00"} as const;
export const verifyBillExtension = (approval: Approval, scope: {surface:"BO"|"HO";key:string;extensionId?:string}) =>
  scope.surface === "HO" && scope.key === "bills" && ["pap1422-subscriptions","pap1422-payments"].includes(scope.extensionId ?? "") &&
  JSON.stringify(approval) === JSON.stringify(billApproval);
export const billDefinition = {
  version:1,classification:"TDD_DEFAULT",surface:"HO",key:"bills",label:"Bills",group:"Tài chính", fields:billFields,
  capabilities:{read:permission,history:permission},
  table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:keys.map(field=>({field,visible:true})),
    search:{fields:keys,normalization:"vi-diacritic-insensitive"},filters:{fields:keys,mode:"flat",logic:"AND"},
    sort:{fields:keys,mode:"single",nulls:"last",tieBreak:"record-id"},group:{fields:["status","payer"],mode:"single"},
    views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
    pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},
    interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
  drawer:{density:"one-column",sections,actions:[]},
  detail:{overview:{sections},businessTabs:[
    {id:"subscriptions",label:"Subscriptions",kind:"approved-extension",extensionId:"pap1422-subscriptions",source:{adapter:"ho.bills",permission},approval:billApproval},
    {id:"payments",label:"Thanh toán",kind:"approved-extension",extensionId:"pap1422-payments",source:{adapter:"ho.bills",permission},approval:billApproval}],
    history:{kind:"unavailable",reason:"Đang tải lịch sử Bill."}},
} as const satisfies SurfaceDefinition<F>;
export const billMoney = (amount: number, currency: string) => new Intl.NumberFormat("vi-VN",{style:"currency",currency}).format(amount);
export function billRow(b: HoBill): ModuleRow<F> {
  return {id:b.bill.id,name:unavailableBillCode,payer:maskedBillIdentity,students:maskedBillIdentity,center:b.originCenter?.state==="VERIFIED"?b.originCenter.centerName:null,subscriptionCount:String(b.items.length),
    totalView:billMoney(b.netAmountMinor,b.bill.currency),paidView:billMoney(b.collectedAmountMinor,b.bill.currency),
    balanceView:billMoney(b.balanceMinor,b.bill.currency),status:b.paymentState,latestPaymentAt:latestBillPayment(b.transactions),createdAt:b.bill.createdAt};
}
export const billProvider: SurfaceProvider<F> = {pagination:"local-ui",
  async list(_query,scope,fetcher,signal) {
    if (scope.surface !== "HO") throw Error("HO required");
    const rows = await loadBills(fetcher,signal);
    return {records:rows.map(b=>({row:billRow(b),version:String(b.bill.version)})),total:rows.length};
  },
  async detail(id,scope,fetcher,signal) {
    if (scope.surface !== "HO") throw Error("HO required");
    const b = await loadBill(id,fetcher,signal); return {row:billRow(b),version:String(b.bill.version)};
  },
  history:{subjectType:"bill",bind:(fetcher,scope)=>({kind:"provider",source:{adapter:"ho.bills.history",permission},
    async load(subject,_context,cursor,signal) {
      if(scope.surface!=="HO" || subject.type!=="bill" || cursor) return {status:"denied"};
      const b = await loadBill(subject.id,fetcher,signal);
      return {status:"authorized",nextCursor:null,events:(b.history ?? []).map((h,index)=>({
        id:subject.id+":"+index, at:h.occurredAt,actor:[h.actorType,h.actorId].filter(Boolean).join(" · "),action:h.action,
        outcome:h.outcome,source:"Core",subject,redacted:true,
        ...(h.reason ? {changes:[{field:"Lý do",before:null,after:h.reason}]} : {})}))};
    }})},
};

const billRegistry=new TddRegistry(verifyBillExtension);
export const billSchema=billRegistry.register({...billDefinition,data:{
 id:"ho-founder-bills-global",
 list:async()=>{throw Error("Authenticated Founder HO Bill adapter required");},
 detail:async()=>{throw Error("Authenticated Founder HO Bill detail adapter required");},
}});
