"use client";
import {useEffect,useId,useRef,useState} from "react";
import {DrawerFrame,TableFrame,TosButton} from "@pino/design-system/react";
import {loadBill,voidBill} from "@/lib/ho-bills-client";
import {canVoidBill,type HoBill,type BillItem,type BillTransaction} from "@/lib/ho-bills-contract";
import {BoApiError} from "@/lib/bo-api-error";
import {billMoney} from "./schema";

export function BillDomain({id,tab,onSaved}:{id:string;tab:string;onSaved:()=>void}) {
  const [bill,setBill]=useState<HoBill|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [locked,setLocked]=useState(false);
  const writing=useRef(false);
  const intent=useRef("");
  const formId=useId();
  useEffect(()=>{
    const c=new AbortController();
    void loadBill(id,fetch,c.signal).then(b=>{if(!c.signal.aborted){setBill(b);setLocked(false);}})
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Không thể tải Bill.");});
    return ()=>c.abort();
  },[id,retry]);
  const reload=()=>{if(writing.current)return;setBill(null);setOpen(false);setError("");setRetry(n=>n+1);};
  const close=()=>{if(!writing.current)setOpen(false);};
  const submit=async()=>{
    if(writing.current||locked||!bill||!canVoidBill(bill)||!confirmed||!reason.trim()||reason.trim().length>500)return;
    writing.current=true;setBusy(true);setError("");
    try {
      await voidBill(bill,reason,intent.current);
      const saved=await loadBill(id);
      if(!saved.bill.voidedAt||saved.paymentState!=="VOID"||saved.bill.version!==bill.bill.version+1)
        throw Error("Chưa xác minh kết quả Void. Tải lại Bill.");
      setBill(saved);setOpen(false);onSaved();
    } catch(e) {
      setError(e instanceof Error?e.message:"Chưa xác minh kết quả. Tải lại Bill trước khi tiếp tục.");
      // No replay contract exists for Void. Every error requires readback before a new intent.
      setLocked(true);
      if(e instanceof BoApiError && [401,403].includes(e.status)){setBill(null);setOpen(false);}
    } finally {writing.current=false;setBusy(false);}
  };
  const retryButton=<TosButton type="button" variant="secondary" disabled={busy} onClick={reload}>Tải lại Bill</TosButton>;
  if(!bill)return <section aria-label="Chi tiết Bill">{error?<p role="alert">{error}</p>:<p role="status">Đang tải Bill…</p>}{error?retryButton:null}</section>;
  const money=(n:number)=>billMoney(n,bill.bill.currency);
  if(tab!=="subscriptions"&&tab!=="payments")return null;
  return <section aria-label={tab==="subscriptions"?"Subscriptions":"Thanh toán"}>
    {error?<p role="alert">{error} {retryButton}</p>:null}
    {tab==="subscriptions"?<>
      <h3>Subscriptions</h3>
      <p>{bill.bill.voidedAt?"Bill đã Void; dữ liệu tài chính được giữ nguyên.":!canVoidBill(bill)?
        "Bill đã có giao dịch hoặc đã thanh toán. Không thể Void.":"HO chỉ xem hoặc Void Bill."}</p>
      <TosButton type="button" variant="destructive" disabled={busy||locked||!canVoidBill(bill)} onClick={()=>{
        intent.current="bill-void-"+crypto.randomUUID();setReason("");setConfirmed(false);setError("");setOpen(true);
      }}>Void Bill</TosButton>
      <TableFrame<BillItem> surface="ho" caption="Subscriptions của Bill" rows={bill.items} rowKey={r=>r.id} columns={[
        {key:"student",label:"Học viên",render:r=>r.studentProfileId},
        {key:"subscription",label:"Subscription",render:r=><><strong>{r.descriptionSnapshot}</strong><p>{r.subscriptionId}</p></>},
        {key:"price",label:"Học phí",render:r=>money(r.unitPriceMinor)},
        {key:"discount",label:"Giảm giá",render:r=>money(r.discountAmountMinor)},
        {key:"net",label:"Thành tiền",render:r=>money(r.quantity*r.unitPriceMinor-r.discountAmountMinor)}]}/>
      <dl><div className="property-row"><dt>Tổng trước giảm giá Bill</dt><dd>{money(bill.grossAmountMinor-bill.itemDiscountMinor)}</dd></div>
        <div className="property-row"><dt>Giảm giá Bill</dt><dd>{money(bill.bill.billDiscountMinor)}</dd></div>
        <div className="property-row"><dt>Tổng Bill</dt><dd>{money(bill.netAmountMinor)}</dd></div>
        <div className="property-row"><dt>Hạn thanh toán</dt><dd>{bill.bill.dueOn??"—"}</dd></div>
        {bill.bill.voidedAt?<div className="property-row"><dt>Void lúc</dt><dd>{bill.bill.voidedAt}</dd></div>:null}</dl>
    </>:<>
      <h3>Thanh toán</h3><p>{bill.paymentState}</p>
      <dl><div className="property-row"><dt>Tổng phải thu</dt><dd>{money(bill.netAmountMinor)}</dd></div>
        <div className="property-row"><dt>Đã thu</dt><dd>{money(bill.collectedAmountMinor)}</dd></div>
        <div className="property-row"><dt>Còn lại</dt><dd>{money(bill.balanceMinor)}</dd></div></dl>
      <p>Khoản thanh toán thuộc toàn Bill, không tự phân bổ cho từng Subscription.</p>
      <TableFrame<BillTransaction> surface="ho" caption="Giao dịch thanh toán" rows={bill.transactions} rowKey={r=>r.id} empty="Chưa có giao dịch." columns={[
        {key:"id",label:"Mã giao dịch",render:r=><>{r.id}<p>{r.transactionKind} · {r.status}</p></>},
        {key:"date",label:"Ngày",render:r=>r.occurredAt},{key:"method",label:"Phương thức",render:r=>r.method},
        {key:"amount",label:"Số tiền",render:r=>money(r.amountMinor)}]}/>
      <p>HO chỉ xem giao dịch thanh toán.</p>
    </>}
    {open?<DrawerFrame surface="ho" title="Xác nhận Void Bill" onClose={close} footer={<>
      <TosButton type="button" variant="secondary" disabled={busy} onClick={close}>Hủy</TosButton>
      <TosButton type="submit" form={formId} variant="destructive" disabled={busy||locked||!confirmed||!reason.trim()||reason.trim().length>500}
        aria-busy={busy}>{busy?"Đang xử lý…":"Xác nhận Void"}</TosButton>
    </>}><form id={formId} aria-busy={busy} onSubmit={e=>{e.preventDefault();void submit();}}>
      <p>Void {bill.bill.id}? Bill sẽ không còn được tính vào công nợ hiệu lực. Các dòng và lịch sử vẫn được giữ lại.</p>
      <div className="property-row"><label htmlFor={formId+"-reason"}>Lý do Void</label>
        <textarea id={formId+"-reason"} rows={3} required maxLength={500} value={reason} disabled={busy||locked} onChange={e=>setReason(e.target.value)}/></div>
      <label><input type="checkbox" checked={confirmed} disabled={busy||locked} onChange={e=>setConfirmed(e.target.checked)}/> Tôi xác nhận Void Bill này.</label>
      {error?<p role="alert">{error}</p>:null}
      {locked?retryButton:null}
    </form></DrawerFrame>:null}
  </section>;
}
