"use client";
/** PAP-1882 / PAP-1491 SPEC-UNLOCK — independent Subscription Sale.
 * BO Create and View share DrawerFrame + PropertySections and canonical Subscription field keys.
 * No Running Class, Enrollment, activation, Renewal, legacy Parent search or raw IDs in UI.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections, type CreateDrawerField } from "@/app/components/workspace-renderer/Properties";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { boApi, BoApiError } from "@/lib/bo-api";
import { studentCenterApi } from "@/lib/bo-student-center-api";
import { readSubscriptionCenterDetail } from "@/lib/bo-subscription-center-detail-client";
import type { BoLearnerDirectoryItem, BoPathProgram, BoProductPlan } from "@/lib/bo-model";
import type { BoField, BoRecord } from "@/lib/bo-registration";
import { nativeSubscriptionModule } from "@/lib/pap1334-native-subscription-read";
import { amountFromPercent, percentFromAmount, quoteAfterDiscounts, suggestedContractSunday } from "@/lib/bo-subscription-create-ux";
import { assertIndependentSaleReadback, buildIndependentSaleBody, eligibleSalePayers, validSaleCenter, type EligibleSalePayer, type IndependentSaleBody } from "@/lib/pap1882-independent-sale";
import styles from "./subscription-create-drawer.module.css";

type Props = {
  initialStudentId?: string | null;
  paths: BoPathProgram[];
  onChanged: () => void;
  onClose: () => void;
};
type Attempt = { key: string; centerId: string; body: IndependentSaleBody };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_CODES = new Set(["artchitect","pianohouse","little-piner-art","little-piner-piano"]);
const fromSubscription=(key:string):BoField=>{
  const field=nativeSubscriptionModule.fields.find(f=>f.key===key);
  if(!field)throw Error("Missing canonical Subscription field: "+key);
  return field;
};
const FIELDS:BoField[]=[
  {key:"center",label:"Cơ sở",type:"text",icon:"⌂",w:180},
  fromSubscription("name"),
  {key:"payer",label:"Phụ huynh thanh toán",type:"person",icon:"♙",w:180},
  fromSubscription("path"),
  {key:"plan",label:"Gói học",type:"text",icon:"▦",w:180},
  fromSubscription("start"),
  fromSubscription("end"),
  {key:"itemDiscount",label:"Giảm giá sản phẩm",type:"currency",icon:"₫",w:180},
  {key:"billDiscount",label:"Giảm giá hóa đơn",type:"currency",icon:"₫",w:180},
  {key:"dueOn",label:"Hạn thanh toán",type:"date",icon:"▦",w:180},
  {key:"campaign",label:"Tham chiếu",type:"text",icon:"Aa",w:180},
];
const SECTIONS=[
  {id:"student",label:"Học viên & cơ sở",fields:["center","name"]},
  {id:"sale",label:"Gói học & người thanh toán",fields:["payer","path","plan"]},
  {id:"contract",label:"Hợp đồng & ưu đãi",fields:["start","end","itemDiscount","billDiscount","dueOn","campaign"]},
] as const;
function today():string {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function formatVnd(n:number):string {
  return Number.isSafeInteger(n) && n>=0 ? new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(n) : "—";
}
function errorMessage(cause:unknown):string {
  return cause instanceof Error ? cause.message : "Không thể xác nhận Sale; thử lại cùng yêu cầu.";
}
function control(id:string,node:ReactNode):CreateDrawerField {
  return {id,value:"",onChange:()=>{},control:node};
}
export function SubscriptionCreateDrawer({initialStudentId,paths,onChanged,onClose}:Props) {
  const center=useBoCenterSelection();
  // Snapshot selected Center at mount: this component is keyed by the canonical Center DSA.
  const [centerId]=useState(()=>center?.selected || "");
  const centerValid=!!center && !center.loading && !center.error &&
    center.selected===centerId && validSaleCenter(centerId,center.centers);
  const centerName=center?.centers.find(item=>item.id===centerId)?.displayName || "Cơ sở hiện tại";
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<BoLearnerDirectoryItem|null>(null);
  const [matches,setMatches]=useState<BoLearnerDirectoryItem[]>([]);
  const [searchState,setSearchState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [payerState,setPayerState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [payers,setPayers]=useState<EligibleSalePayer[]>([]);
  const [payerId,setPayerId]=useState("");
  const [payerScope,setPayerScope]=useState<{centerId:string;studentId:string}|null>(null);
  const [plans,setPlans]=useState<BoProductPlan[]>([]);
  const [planState,setPlanState]=useState<"loading"|"ready"|"error">("loading");
  const [planId,setPlanId]=useState("");
  const [pathId,setPathId]=useState("");
  const [startsOn,setStartsOn]=useState(today);
  const [contractEndsOn,setContractEndsOn]=useState(()=>suggestedContractSunday(today(),12));
  const [endManual,setEndManual]=useState(false);
  const [itemAmount,setItemAmount]=useState("0");
  const [itemPercent,setItemPercent]=useState("0");
  const [billAmount,setBillAmount]=useState("0");
  const [billPercent,setBillPercent]=useState("0");
  const [billPercentMode,setBillPercentMode]=useState(false);
  const [dueOn,setDueOn]=useState("");
  const [campaign,setCampaign]=useState("");
  const [busy,setBusy]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const attempted=useRef<Attempt|null>(null);
  const inFlight=useRef(false);
  const searchRef=useRef<HTMLInputElement>(null);
  const querySeq=useRef(0);
  const selectablePaths=useMemo(()=>paths.filter(p=>p.status==="ACTIVE"&&PATH_CODES.has(p.code)),[paths]);
  const selectablePlans=useMemo(()=>plans.filter(p=>p.enabled&&p.termWeeks===12&&p.cadence>=1&&p.cadence<=3),[plans]);
  const plan=selectablePlans.find(p=>p.id===planId)??null;
  const price=plan?.listPriceMinor??0;
  const item=Number(itemAmount);
  const bill=Number(billAmount);
  const quote=quoteAfterDiscounts(price,item,bill);
  const locked=busy||uncertain||success;
  // Fail closed when Parent eligibility was read for a different Student or Center.
  const payerReady=!!selected&&payerState==="ready"&&payerScope?.centerId===centerId&&payerScope.studentId===selected.id&&centerValid;
  const formEnabled=payerReady&&payers.length>0&&planState==="ready"&&!!plan&&!!pathId&&!locked;

  useEffect(()=>{
    const next=selectablePaths[0]?.id||"";
    setPathId(current=>selectablePaths.some(p=>p.id===current)?current:next);
  },[selectablePaths]);
  useEffect(()=>{
    let active=true;
    void boApi.billingProductPlans().then(rows=>{if(!active)return;setPlans(rows);setPlanState("ready");})
      .catch(cause=>{if(!active)return;setPlanState("error");setError(errorMessage(cause));});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    setPlanId(current=>selectablePlans.some(p=>p.id===current)?current:(selectablePlans.find(p=>p.badge==="HERO")||selectablePlans[0])?.id||"");
  },[selectablePlans]);
  useEffect(()=>{
    if(!endManual)setContractEndsOn(suggestedContractSunday(startsOn,plan?.termWeeks||12));
    const remaining=Math.max(0,price-Number(itemAmount));
    if(billPercentMode)setBillAmount(String(amountFromPercent(remaining,Number(billPercent))));
  // The explicit start/date/discount handlers own their own recalculation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planId,price]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>searchRef.current?.focus());
    return ()=>cancelAnimationFrame(frame);
  },[]);
  useEffect(()=>{
    if(!initialStudentId||!centerValid||!UUID.test(initialStudentId))return;
    let active=true;
    void studentCenterApi.learnerLifecycle(initialStudentId,centerId).then(value=>{
      if(!active)return;
      if(value.student.status!=="ACTIVE")throw Error("Học viên không đang hoạt động tại cơ sở.");
      setSelected(value.student);setQuery(value.student.displayName);
    }).catch(cause=>{if(active)setError(errorMessage(cause));});
    return ()=>{active=false;};
  },[initialStudentId,centerId,centerValid]);
  useEffect(()=>{
    if(selected||query.trim().length<2||!centerValid)return;
    const seq=++querySeq.current;let active=true;
    const handle=setTimeout(()=>{
      setSearchState("loading");
      void studentCenterApi.learners(query.trim(),20,undefined,centerId).then(rows=>{
        if(!active||seq!==querySeq.current)return;
        setMatches(rows.filter(row=>row.status==="ACTIVE"));
        setSearchState("ready");
      }).catch(()=>{if(active&&seq===querySeq.current)setSearchState("error");});
    },220);
    return ()=>{active=false;clearTimeout(handle);};
  },[query,selected,centerId,centerValid]);
  useEffect(()=>{
    setPayers([]);setPayerId("");setPayerScope(null);
    if(!selected||!centerValid)return;
    const ctl=new AbortController();setPayerState("loading");
    void eligibleSalePayers(centerId,selected.id,ctl.signal).then(rows=>{
      if(ctl.signal.aborted)return;
      setPayers(rows);setPayerId(rows[0]?.id||"");setPayerScope({centerId,studentId:selected.id});setPayerState("ready");
    }).catch(cause=>{
      if(ctl.signal.aborted)return;
      setPayerState("error");setError(errorMessage(cause));
    });
    return ()=>ctl.abort();
  },[selected?.id,centerId,centerValid]);

  async function choose(row:BoLearnerDirectoryItem){
    if(locked||!centerValid)return;
    setSearchState("loading");setError("");setMatches([]);
    try{
      const life=await studentCenterApi.learnerLifecycle(row.id,centerId);
      if(!centerValid||life.student.id!==row.id||life.student.status!=="ACTIVE")
        throw Error("Học viên không hợp lệ tại cơ sở.");
      setSelected(life.student);setQuery(life.student.displayName);setSearchState("ready");
    }catch(cause){setSearchState("error");setError(errorMessage(cause));}
  }
  function resetStudent(){
    if(locked)return;
    setSelected(null);setQuery("");setMatches([]);setPayers([]);setPayerId("");setPayerScope(null);setSearchState("idle");setPayerState("idle");setError("");
  }
  function onItemAmount(value:string){
    setItemAmount(value);
    const numeric=Number(value),remain=Math.max(0,price-numeric);
    setItemPercent(String(percentFromAmount(price,numeric)));
    if(billPercentMode)setBillAmount(String(amountFromPercent(remain,Number(billPercent))));
  }
  function onItemPercent(value:string){
    setItemPercent(value);const numeric=amountFromPercent(price,Number(value));
    setItemAmount(String(numeric));
    if(billPercentMode)setBillAmount(String(amountFromPercent(Math.max(0,price-numeric),Number(billPercent))));
  }
  function onBillAmount(value:string){
    setBillPercentMode(false);setBillAmount(value);
    setBillPercent(String(percentFromAmount(Math.max(0,price-Number(itemAmount)),Number(value))));
  }
  function onBillPercent(value:string){
    setBillPercentMode(true);setBillPercent(value);
    setBillAmount(String(amountFromPercent(Math.max(0,price-Number(itemAmount)),Number(value))));
  }
  function closeIfSafe(){
    if(inFlight.current||uncertain)return;
    if(!success&&(selected||campaign||Number(itemAmount)||Number(billAmount))&&!window.confirm("Bỏ thông tin Sale chưa lưu?"))return;
    onClose();
  }
  async function submit(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();
    if(inFlight.current||success)return;
    if(!centerValid){setError("Cơ sở đã thay đổi hoặc không được cấp quyền; đóng rồi mở lại.");return;}
    if(!selected||!plan||!pathId||!payerId||!payerReady){setError("Chọn học viên, Parent đủ điều kiện, Path và Product Plan.");return;}
    let attempt:Attempt;
    try{
      if(attempted.current){
        if(attempted.current.centerId!==centerId||attempted.current.body.studentProfileId!==selected.id)
          throw Error("Cơ sở hoặc học viên đã thay đổi; không thể chạy lại Sale cũ.");
        attempt=attempted.current;
      }else{
        const body=buildIndependentSaleBody({
          centerId,studentProfileId:selected.id,payerParentUserId:payerId,
          pathProgramId:pathId,productPlanId:plan.id,
          contractualStartsOn:startsOn,contractualEndsOn:contractEndsOn,
          itemDiscountMinor:Number(itemAmount),billDiscountMinor:Number(billAmount),
          ...(dueOn?{dueOn}:{}),...(campaign.trim()?{campaignReference:campaign.trim()}:{}),
        },plan,payers);
        attempt={centerId,key:crypto.randomUUID(),body};attempted.current=attempt;
      }
    }catch(cause){setError(errorMessage(cause));return;}
    inFlight.current=true;setBusy(true);setUncertain(false);setError("");
    let saleCommitted=false;
    try{
      // No deferActivation: Core's PAP-1350 Sale activates the independent subscription atomically.
      const sale=await boApi.createBillingSale(attempt.body,attempt.key);
      saleCommitted=true;
      const verified=await readSubscriptionCenterDetail(sale.subscriptionId,attempt.centerId);
      // PAP-1897: Core Sale 201 already atomically returns Bill+Item receipt.
      // A separate GET /billing/bills/:id requires broader finance ACL and may 403
      // AFTER the Sale is committed; do not turn success into a false failure.
      assertIndependentSaleReadback(attempt.body,sale,verified);
      setSuccess(true);onChanged();
    }catch(cause){
      // A network/5xx/readback uncertainty must replay the EXACT body and key, not create a second Bill.
      // A 201-acknowledged Sale must never discard its original replay key,
      // even if the later independent Center-attested readback fails.
      const definitive=!saleCommitted&&cause instanceof BoApiError&&cause.structuredResponse&&[400,401,403,404,422].includes(cause.status);
      if(definitive){attempted.current=null;setUncertain(false);}
      else setUncertain(true);
      setError(errorMessage(cause));
    }finally{inFlight.current=false;setBusy(false);}
  }

  const record:BoRecord={
    id:"",name:centerValid?selected?.displayName||"":"",center:centerValid?centerName:"",payer:centerValid?payers.find(p=>p.id===payerId)?.displayName||"":"",
    path:selectablePaths.find(p=>p.id===pathId)?.displayName||"",
    plan:plan?plan.cadence+" buổi/tuần · "+plan.termWeeks+" tuần":"",
    start:startsOn,end:contractEndsOn,itemDiscount:item,billDiscount:bill,
    dueOn,campaign,
  };
  const fields:Record<string,CreateDrawerField>={
    name:control("subscription-create-student-search",<div className={styles.picker}>
      <div className={styles.searchLine}>
        <input id="subscription-create-student-search" ref={searchRef} className="edit-input" role="combobox"
          aria-autocomplete="list" aria-controls="subscription-create-search-results" aria-expanded={matches.length>0}
          autoComplete="off" placeholder="Tìm tên học viên trong cơ sở…" value={query} disabled={!centerValid||locked}
          onChange={e=>{resetStudent();setQuery(e.target.value);}}
          onKeyDown={e=>{if(e.key==="Enter"&&matches.length){e.preventDefault();void choose(matches[0]!);}
            if(e.key==="Escape"&&matches.length){e.stopPropagation();setMatches([]);}}} />
        {selected&&!locked?<button type="button" className={styles.clear} aria-label="Đổi học viên" onClick={resetStudent}>×</button>:null}
      </div>
      {!selected&&query.trim().length>=2?<div id="subscription-create-search-results" role="listbox" aria-label="Kết quả tìm học viên" className={styles.results}>
        {matches.map(row=><button key={row.id} type="button" role="option" aria-selected={false} className={styles.result} onClick={()=>void choose(row)}><strong>{row.displayName}</strong></button>)}
        {searchState==="loading"?<span className={styles.empty}>Đang tìm học viên…</span>:
         searchState==="ready"&&!matches.length?<span className={styles.empty}>Không có học viên phù hợp.</span>:
         searchState==="error"?<span className={styles.error}>Không tải được học viên.</span>:null}
      </div>:null}
    </div>),
    payer:control("subscription-create-payer",<select id="subscription-create-payer" className="edit-input" required value={payerId} disabled={locked||!payerReady} onChange={e=>setPayerId(e.target.value)}>
      <option value="">Chọn phụ huynh đủ điều kiện</option>
      {payers.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}
    </select>),
    path:control("subscription-create-path",<select id="subscription-create-path" className="edit-input" required value={pathId} disabled={locked} onChange={e=>setPathId(e.target.value)}>
      <option value="">Chọn hành trình</option>{selectablePaths.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}
    </select>),
    plan:control("subscription-create-plan",<select id="subscription-create-plan" className="edit-input" required value={planId} disabled={locked||planState!=="ready"} onChange={e=>setPlanId(e.target.value)}>
      <option value="">Chọn gói học</option>{selectablePlans.map(p=><option key={p.id} value={p.id}>{p.cadence} buổi/tuần · {p.termWeeks} tuần · {formatVnd(p.listPriceMinor)}</option>)}
    </select>),
    start:control("subscription-create-start",<input id="subscription-create-start" className="edit-input" type="date" required value={startsOn} disabled={locked} onChange={e=>{setStartsOn(e.target.value);if(!endManual)setContractEndsOn(suggestedContractSunday(e.target.value,plan?.termWeeks||12));}} />),
    end:control("subscription-create-end",<div className={styles.inlineControl}><input id="subscription-create-end" className="edit-input" type="date" min={startsOn} required value={contractEndsOn} disabled={locked} onChange={e=>{setEndManual(true);setContractEndsOn(e.target.value);}} /><button type="button" className="secondary-btn" disabled={locked} onClick={()=>{setEndManual(false);setContractEndsOn(suggestedContractSunday(startsOn,plan?.termWeeks||12));}}>Ngày gợi ý</button></div>),
    itemDiscount:control("subscription-create-item-discount",<div className={styles.discountControls}>
      <label>VNĐ<input id="subscription-create-item-discount" aria-label="Giảm giá sản phẩm VNĐ" className="edit-input" type="number" min={0} step={1} disabled={locked} value={itemAmount} onChange={e=>onItemAmount(e.target.value)} /></label>
      <label>%<input className="edit-input" aria-label="Giảm giá sản phẩm phần trăm" type="number" min={0} max={100} step="0.01" disabled={locked} value={itemPercent} onChange={e=>onItemPercent(e.target.value)} /></label></div>),
    billDiscount:control("subscription-create-bill-discount",<div className={styles.discountControls}>
      <label>VNĐ<input id="subscription-create-bill-discount" aria-label="Giảm giá Bill VNĐ" className="edit-input" type="number" min={0} step={1} disabled={locked} value={billAmount} onChange={e=>onBillAmount(e.target.value)} /></label>
      <label>%<input className="edit-input" aria-label="Giảm giá Bill phần trăm" type="number" min={0} max={100} step="0.01" disabled={locked} value={billPercent} onChange={e=>onBillPercent(e.target.value)} /></label></div>),
    dueOn:control("subscription-create-due",<input id="subscription-create-due" className="edit-input" type="date" value={dueOn} disabled={locked} onChange={e=>setDueOn(e.target.value)} />),
    campaign:control("subscription-create-campaign",<input id="subscription-create-campaign" className="edit-input" type="text" maxLength={200} value={campaign} disabled={locked} onChange={e=>setCampaign(e.target.value)} placeholder="Tuỳ chọn" />),
  };
  return <DrawerFrame title="Tạo gói học" path="Gói học · Đăng ký độc lập" onClose={closeIfSafe}
    footer={<>
      <button type="button" className="secondary-btn" onClick={closeIfSafe} disabled={busy||uncertain}>{success?"Đóng":"Hủy"}</button>
      {uncertain?<button type="button" className="primary-btn" disabled={busy||!centerValid} onClick={()=>void submit()}>Thử lại cùng yêu cầu</button>:
      !success?<button type="submit" form="pap1882-sale-form" className="primary-btn" disabled={!formEnabled}>{busy?"Đang tạo…":"Tạo Subscription"}</button>:<span role="status">Đã tạo thành công</span>}
    </>}>
    <form id="pap1882-sale-form" onSubmit={event=>void submit(event)} data-pap1882-sale="independent" data-tdd-create="subscription">
      {!centerValid?<div className={styles.error} role="alert">Không có cơ sở hợp lệ hoặc cơ sở đã thay đổi; đóng drawer và chọn lại tại switcher.</div>:null}
      {payerState==="loading"?<p role="status" className={styles.empty}>Đang xác minh Parent đủ điều kiện tại cơ sở…</p>:null}
      {payerState==="ready"&&selected&&!payers.length?<p role="alert" className={styles.error}>Học viên chưa có phụ huynh đủ điều kiện thanh toán tại cơ sở.</p>:null}
      {planState==="error"?<p role="alert" className={styles.error}>Không thể tải Product Plans; không thể tạo Sale.</p>:null}
      {centerValid?<PropertySections fields={FIELDS} record={record} sections={SECTIONS} variant="drawer" createFields={fields} />:null}
      <div className={styles.quote} role="status">Giá niêm yết: {formatVnd(price)} · Thành tiền dự kiến: <strong>{quote.valid?formatVnd(quote.net):"Giảm giá không hợp lệ"}</strong><small>Core quyết định giá và Bill chính thức. Không cần Running Class hay Enrollment.</small></div>
      {error?<div className={styles.error} role="alert">{error}{uncertain?<p>Kết quả chưa xác định. Chỉ thử lại cùng yêu cầu; không tạo Sale mới.</p>:null}</div>:null}
      {success?<div className={styles.success} role="status">Đã tạo Subscription ACTIVE và Bill độc lập. Core xác nhận đúng học viên, cơ sở và Bill.</div>:null}
    </form>
  </DrawerFrame>;
}