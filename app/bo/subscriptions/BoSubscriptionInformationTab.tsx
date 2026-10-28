"use client";

import {useEffect,useState} from "react";
import {boApi,BoApiError} from "@/lib/bo-api";
import type {BoBillSummary,BoLearnerSubscription,BoProductPlan} from "@/lib/bo-model";
import {subscriptionBillItem} from "@/lib/bo-subscription-bill-match";

type Catalog={paths:Array<{id:string;displayName:string}>;classes:Array<{id:string;name:string}>};
type Enrollment={runningClassId:string;effectiveFromLocalDate:string;effectiveUntilExclusiveLocalDate:string|null};
type Settled<T>={value:T|null;error:string|null};
type Ready={state:"ready";subscription:BoLearnerSubscription;plans:Settled<BoProductPlan[]>;catalog:Settled<Catalog>;enrollments:Settled<Enrollment[]>;bill:Settled<BoBillSummary|null>;hasBillReference:boolean};
type Load=Ready|{state:"loading"}|{state:"error"|"permission";message:string};
const money=(value:number,currency:string)=>Number.isFinite(value)?new Intl.NumberFormat("vi-VN").format(value)+" "+(currency==="VND"?"₫":currency):"—";
const present=(value:string|null|undefined)=>value?.trim()||"—";
const billRef=(reference:string|null)=>/^bill:([0-9a-f-]{36})$/i.exec(reference??"")?.[1]??null;
function unpack<T>(result:PromiseSettledResult<T>):Settled<T>{
  return result.status==="fulfilled"?{value:result.value,error:null}:{value:null,error:result.reason instanceof BoApiError&&[401,403].includes(result.reason.status)?"Không đủ quyền xem dữ liệu.":result.reason instanceof Error?result.reason.message:"Không thể tải dữ liệu."};
}
function Field({label,value}:{label:string;value:string|number}){
  return <div className="v24-prop-item"><div className="v24-prop-key">{label}</div><div className="v24-prop-value readonly" aria-label={"Chỉ đọc "+label}>{value}<span className="v24-lock" aria-label="Chỉ đọc">⌁</span></div></div>;
}
/** PAP-1102: immutable Subscription ID is the only selected-record authority; never use a mock Bill. */
export function BoSubscriptionInformationTab({subscriptionId,studentName}:{subscriptionId:string;studentName:string}){
  const [load,setLoad]=useState<Load>({state:"loading"});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setLoad({state:"loading"});
    void (async()=>{
      try{
        const subscription=await boApi.subscriptionById(subscriptionId);
        if(subscription.id!==subscriptionId)throw new Error("Core trả về Subscription ID không khớp.");
        const reference=billRef(subscription.commercialReference);
        const [plans,catalog,enrollments,bill]=await Promise.allSettled([
          boApi.billingProductPlans(),boApi.scopeCatalog(),boApi.subscriptionEnrollments(subscriptionId),
          reference?boApi.billingBill(reference):Promise.resolve(null)
        ]);
        if(active)setLoad({state:"ready",subscription,plans:unpack(plans),catalog:unpack(catalog),enrollments:unpack(enrollments),bill:unpack(bill),hasBillReference:!!reference});
      }catch(error){
        if(active)setLoad({state:error instanceof BoApiError&&[401,403].includes(error.status)?"permission":"error",message:error instanceof Error?error.message:"Không thể tải Thông Tin Subscription."});
      }
    })();
    return()=>{active=false};
  },[subscriptionId,retry]);
  if(load.state==="loading")return <div role="status" className="v24-audit-empty">Đang tải thông tin từ Core…</div>;
  if(load.state!=="ready")return <div role="alert" className="v24-audit-empty">{load.state==="permission"?"Không đủ quyền xem Subscription (401/403).":load.message} <button type="button" className="secondary-btn" onClick={()=>setRetry(x=>x+1)}>Thử lại</button></div>;
  const {subscription:sub}=load;
  const plan=load.plans.value?.find(p=>p.id===sub.productPlanId);
  const path=load.catalog.value?.paths.find(p=>p.id===sub.pathProgramId);
  const bill=load.bill.value;
  const item=subscriptionBillItem(bill,sub);
  const billMatched=Boolean(item);
  const unitCurrency=bill?.bill.currency??plan?.currency??"VND";
  const classNames=new Map(load.catalog.value?.classes.map(c=>[c.id,c.name])??[]);
  return <>
    <section className="v24-prop-section" aria-label="Subscription thông tin Core">
      <div className="v24-section-heading"><h4>Thông tin Subscription</h4><button type="button" className="secondary-btn" onClick={()=>setRetry(x=>x+1)}>↻ Làm mới</button></div>
      <div className="v24-prop-grid">
        <Field label="Subscription ID" value={sub.id}/>
        <Field label="Học viên" value={present(studentName)}/>
        <Field label="Student ID" value={sub.studentProfileId}/>
        <Field label="Trạng thái" value={sub.lifecycle}/>
        <Field label="Path" value={path?.displayName??sub.pathProgramId}/>
        <Field label="Product Plan" value={sub.productPlanId??"Chưa liên kết"}/>
        <Field label="Buổi / tuần" value={sub.weeklyCommitment}/>
        <Field label="Kỳ học" value={sub.termWeeks!=null?sub.termWeeks+" tuần":"Không có dữ liệu"}/>
        <Field label="Ngày bắt đầu dịch vụ" value={present(sub.serviceStartsOn)}/>
        <Field label="Ngày bắt đầu hợp đồng" value={present(sub.contractualStartsOn)}/>
        <Field label="Ngày kết thúc hợp đồng" value={present(sub.contractualEndsOn)}/>
        <Field label="Ngày hoàn tất" value={present(sub.completedAt)}/>
      </div>
      {load.plans.error?<p role="status">{load.plans.error} Không suy diễn giá từ Plan hiện tại.</p>:null}
    </section>
    <section className="v24-prop-section" aria-label="Thông tin Bill Core">
      <div className="v24-section-heading"><h4>Bill & mức giá đã xác nhận</h4></div>
      {!load.hasBillReference?<p role="status">Subscription chưa có tham chiếu Bill hợp lệ.</p>
        :load.bill.error?<p role="status">{load.bill.error} Không hiển thị số liệu Billing khi chưa được xác minh.</p>
        :!bill?<p role="status">Không có Bill được Core trả về.</p>
        :!billMatched?<p role="alert">BillItem không khớp Subscription, Student hoặc Plan. Không hiển thị giá để tránh gán nhầm hóa đơn.</p>
        :<div className="v24-prop-grid">
          <Field label="Bill ID" value={bill.bill.id}/>
          <Field label="Parent thanh toán (ID)" value={bill.bill.payerParentUserId}/>
          <Field label="Đơn giá tại thời điểm bán" value={money(item!.unitPriceMinor,unitCurrency)}/>
          <Field label="Giảm giá sản phẩm" value={money(item!.discountAmountMinor,unitCurrency)}/>
          <Field label="Giảm giá Bill (toàn hóa đơn)" value={money(bill.bill.billDiscountMinor,unitCurrency)}/>
          <Field label="Thành tiền Bill (toàn hóa đơn)" value={money(bill.netAmountMinor,unitCurrency)}/>
          <Field label="Trạng thái thanh toán" value={bill.paymentState}/>
          <Field label="Hạn thanh toán" value={present(bill.bill.dueOn)}/>
        </div>}
    </section>
    <section className="v24-prop-section" aria-label="Running Classes liên kết">
      <div className="v24-section-heading"><h4>Running Classes</h4></div>
      {load.enrollments.error?<p role="status">{load.enrollments.error}</p>
        :!load.enrollments.value?.length?<p role="status">Chưa có Enrollment.</p>
        :<div className="v24-prop-grid">{load.enrollments.value.map((entry,index)=><Field key={index} label={"Lớp "+(index+1)} value={(classNames.get(entry.runningClassId)??entry.runningClassId)+" · "+entry.effectiveFromLocalDate+" → "+(entry.effectiveUntilExclusiveLocalDate??"Đang mở")}/>)}</div>}
    </section>
  </>;
}
