"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {boApi,BoApiError} from "@/lib/bo-api";
import type {
  BoLearnerLifecycle,BoPathProgram,BoSession,BoSpecialtyCatalog,
  BoSpecialtyPurchaseDecision,BoSpecialtyStudentSummary,
} from "@/lib/bo-model";
import styles from "./bo-subscriptions.module.css";

type Props={
  lifecycle:BoLearnerLifecycle;
  paths:BoPathProgram[];
  blocked:boolean;
  onChanged:()=>Promise<void>;
};
type Load<T>={state:"loading"}|{state:"error";message:string}|{state:"ready";data:T};

export function SpecialtyWorkspace({lifecycle,paths,blocked,onChanged}:Props){
  const [catalog,setCatalog]=useState<Load<BoSpecialtyCatalog>>({state:"loading"});
  const [summary,setSummary]=useState<Load<BoSpecialtyStudentSummary>>({state:"loading"});
  const [sessions,setSessions]=useState<BoSession[]>([]);
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [pathId,setPathId]=useState("");
  const [familyName,setFamilyName]=useState("");
  const [familyCode,setFamilyCode]=useState("");
  const [levelCount,setLevelCount]=useState("1");
  const [moduleId,setModuleId]=useState("");
  const [offerMode,setOfferMode]=useState("UPGRADE");
  const [price,setPrice]=useState("690000");
  const [units,setUnits]=useState("8");
  const [offerCode,setOfferCode]=useState("upgrade");
  const [offerId,setOfferId]=useState("");
  const [payerId,setPayerId]=useState("");
  const [sourceSubscriptionId,setSourceSubscriptionId]=useState("");
  const [decision,setDecision]=useState<BoSpecialtyPurchaseDecision|null>(null);
  const refresh=useCallback(async()=>{
    const [pathCatalogs,nextSummary,nextSessions]=await Promise.all([
      Promise.all(paths.filter(item=>item.status==="ACTIVE").map(async item=>{
        try{return await boApi.specialtyCatalog(item.id)}
        catch(cause){if(cause instanceof BoApiError&&cause.status===403)return null;throw cause}
      })).then(items=>items.filter((item):item is BoSpecialtyCatalog=>item!==null)),
      boApi.specialtyStudent(lifecycle.student.id),boApi.sessions(),
    ]);
    const nextCatalog:BoSpecialtyCatalog={
      families:pathCatalogs.flatMap(item=>item.families),modules:pathCatalogs.flatMap(item=>item.modules),
      offers:pathCatalogs.flatMap(item=>item.offers),rewards:pathCatalogs.flatMap(item=>item.rewards),
      relics:[...new Map(pathCatalogs.flatMap(item=>item.relics).map(item=>[item.id,item])).values()],
    };
    setCatalog({state:"ready",data:nextCatalog});
    setSummary({state:"ready",data:nextSummary});
    setSessions(nextSessions);
    setPathId(current=>current||paths.find(item=>item.status==="ACTIVE")?.id||"");
    setModuleId(current=>current&&nextCatalog.modules.some(item=>item.id===current)?current:nextCatalog.modules[0]?.id||"");
    setOfferId(current=>current&&nextCatalog.offers.some(item=>item.id===current&&item.enabled)?current:nextCatalog.offers.find(item=>item.enabled)?.id||"");
    setPayerId(current=>current&&lifecycle.guardians.some(item=>item.parent.status==="ACTIVE"&&item.parent.id===current)?current:lifecycle.guardians.find(item=>item.parent.status==="ACTIVE")?.parent.id||"");
  },[lifecycle.student.id,lifecycle.guardians,paths]);
  useEffect(()=>{let active=true;setCatalog({state:"loading"});setSummary({state:"loading"});void refresh().catch(cause=>{if(active){const msg=message(cause);setCatalog({state:"error",message:msg});setSummary({state:"error",message:msg});}});return()=>{active=false};},[refresh]);
  useEffect(()=>{setDecision(null)},[offerId,sourceSubscriptionId,lifecycle.student.id]);

  const activeSubscriptions=useMemo(()=>lifecycle.subscriptions.filter(item=>item.subscription.lifecycle==="ACTIVE"),[lifecycle.subscriptions]);
  const selectedModule=catalog.state==="ready"?catalog.data.modules.find(item=>item.id===moduleId)??null:null;
  const moduleOffers=catalog.state==="ready"?catalog.data.offers.filter(item=>item.specialtyModuleId===moduleId):[];
  const selectedOffer=catalog.state==="ready"?catalog.data.offers.find(item=>item.id===offerId)??null:null;
  const purchaseModule=selectedOffer&&catalog.state==="ready"?catalog.data.modules.find(item=>item.id===selectedOffer.specialtyModuleId)??null:null;
  const purchaseSubscriptions=purchaseModule?activeSubscriptions.filter(item=>item.subscription.pathProgramId===purchaseModule.pathProgramId):[];
  const sessionsForAllocation=(allocation:BoSpecialtyStudentSummary["allocations"][number])=>{
    const allocationModule=catalog.state==="ready"?catalog.data.modules.find(item=>item.id===allocation.specialtyModuleId):null;
    return allocationModule?sessions.filter(item=>item.pathProgramId===allocationModule.pathProgramId&&item.status==="SCHEDULED"):[];
  };

  async function run(key:string,action:()=>Promise<unknown>,success:string,refreshLifecycle=false){
    if(busy||blocked)return;setBusy(key);setNotice(null);setError(null);
    try{await action();await refresh();if(refreshLifecycle)await onChanged();setNotice(success);}
    catch(cause){setError(message(cause));}
    finally{setBusy(null);}
  }

  async function createSpecialty(event:React.FormEvent){
    event.preventDefault();
    const count=integer(levelCount,1),code=slug(familyCode);
    await run("create-specialty",async()=>{
      const family=await boApi.createSpecialtyFamily({pathProgramId:pathId,code,displayName:familyName.trim()});
      for(let level=1;level<=count;level++)await boApi.createSpecialtyModule({
        familyId:family.id,code:`${code}-l${level}`,displayName:`Level ${level}`,level,
      });
    },"Đã tạo Chuyên Đề và các Level canonical.");
  }
  async function createOffer(event:React.FormEvent){
    event.preventDefault();if(!moduleId)return;
    await run("create-offer",()=>boApi.createSpecialtyOffer({
      specialtyModuleId:moduleId,offerCode:slug(offerCode),offerMode:offerMode.trim().toUpperCase(),
      listPriceMinor:money(price),currency:"VND",nominalUnits:integer(units,0),
    }),"Đã tạo Specialty Offer.");
  }
  async function preflight(){
    if(!offerId)return;
    setBusy("preflight");setError(null);setNotice(null);
    try{const value=await boApi.evaluateSpecialtyPurchase({
      studentProfileId:lifecycle.student.id,offerId,sourceSubscriptionId:sourceSubscriptionId||null,effectiveAt:new Date().toISOString(),
    });setDecision(value);setNotice(value.allowed?"Policy hiện tại cho phép purchase.":`Policy từ chối: ${value.reasons.join(", ")}`);}
    catch(cause){setError(message(cause));}finally{setBusy(null);}
  }
  async function purchase(){
    if(!offerId||!payerId)return;
    await run("purchase",async()=>{
      const currentDecision=await boApi.evaluateSpecialtyPurchase({
        studentProfileId:lifecycle.student.id,offerId,sourceSubscriptionId:sourceSubscriptionId||null,effectiveAt:new Date().toISOString(),
      });
      setDecision(currentDecision);
      if(!currentDecision.allowed)throw new Error(`Policy từ chối: ${currentDecision.reasons.join(", ")}`);
      return boApi.createSpecialtyPurchase({
        payerParentUserId:payerId,studentProfileId:lifecycle.student.id,offerId,
        sourceSubscriptionId:sourceSubscriptionId||null,effectiveAt:new Date().toISOString(),
      },crypto.randomUUID());
    },"Đã mua Chuyên Đề; allocation và entitlement đã tạo.");
  }
  async function addPhysicalReward(){
    if(!moduleId)return;const name=window.prompt("Tên phần thưởng vật lý");if(!name?.trim())return;
    const code=window.prompt("Reward code",slug(name));if(!code?.trim())return;
    await run("physical-reward",()=>boApi.createSpecialtyReward({
      specialtyModuleId:moduleId,rewardCode:slug(code),rewardKind:"PHYSICAL",displayName:name.trim(),
    }),"Đã thêm phần thưởng vật lý.");
  }
  async function addRelicReward(){
    if(!moduleId)return;const name=window.prompt("Tên Relic Pinoria");if(!name?.trim())return;
    const key=window.prompt("Relic key",slug(name));if(!key?.trim())return;
    await run("relic-reward",async()=>{
      const relic=await boApi.createSpecialtyRelic({relicKey:slug(key),displayName:name.trim()});
      await boApi.createSpecialtyReward({
        specialtyModuleId:moduleId,rewardCode:`relic-${slug(key)}`,rewardKind:"PINORIA_RELIC",displayName:name.trim(),pinoriaRelicId:relic.id,
      });
    },"Đã tạo và gắn Relic Pinoria.");
  }
  if(catalog.state==="loading"||summary.state==="loading")return <section className={styles.createCard}>Đang tải Specialty foundation…</section>;
  if(catalog.state==="error")return <section className={styles.error}>{catalog.message}</section>;
  if(summary.state==="error")return <section className={styles.error}>{summary.message}</section>;

  return <section className={styles.billingStack}>
    <section className={styles.createCard}>
      <div className={styles.sectionHead}><div><span>Specialty Foundation V1</span><h3>Chuyên Đề</h3></div><small>Business rules do Policy quyết định · Core giữ facts/ledger</small></div>
      {notice?<div className={styles.notice}>{notice}</div>:null}
      {error?<div className={styles.error}>{error}</div>:null}
      <form className={styles.formGrid} onSubmit={event=>void createSpecialty(event)}>
        <label>Path<select required disabled={blocked||Boolean(busy)} value={pathId} onChange={event=>setPathId(event.target.value)}>
          <option value="">Chọn Path</option>{paths.filter(item=>item.status==="ACTIVE").map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select></label>
        <label>Tên Chuyên Đề<input required disabled={blocked||Boolean(busy)} value={familyName} onChange={event=>setFamilyName(event.target.value)}/></label>
        <label>Code<input required disabled={blocked||Boolean(busy)} value={familyCode} onChange={event=>setFamilyCode(event.target.value)}/></label>
        <label>Số Level<input type="number" min="1" required disabled={blocked||Boolean(busy)} value={levelCount} onChange={event=>setLevelCount(event.target.value)}/></label>
        <button className={styles.primary} disabled={blocked||Boolean(busy)} type="submit">Tạo Chuyên Đề</button>
      </form>
    </section>

    <section className={styles.createCard}>
      <div className={styles.sectionHead}><div><span>Level configuration</span><h3>Offer & Rewards</h3></div><small>Units/price chỉ là config</small></div>
      <div className={styles.formGrid}>
        <label>Level<select value={moduleId} onChange={event=>setModuleId(event.target.value)} disabled={blocked||Boolean(busy)}>
          <option value="">Chọn Level</option>{catalog.data.modules.map(item=><option key={item.id} value={item.id}>{item.displayName} · L{item.level}</option>)}
        </select></label>
        <button type="button" disabled={!moduleId||blocked||Boolean(busy)} onClick={()=>void addPhysicalReward()}>+ Physical reward</button>
        <button type="button" disabled={!moduleId||blocked||Boolean(busy)} onClick={()=>void addRelicReward()}>+ Pinoria Relic</button>
      </div>
      <form className={styles.formGrid} onSubmit={event=>void createOffer(event)}>
        <label>Mode<input value={offerMode} onChange={event=>setOfferMode(event.target.value)}/></label>
        <label>Offer code<input value={offerCode} onChange={event=>setOfferCode(event.target.value)}/></label>
        <label>Giá VND<input type="number" min="0" value={price} onChange={event=>setPrice(event.target.value)}/></label>
        <label>Nominal units<input type="number" min="0" value={units} onChange={event=>setUnits(event.target.value)}/></label>
        <button type="submit" disabled={!moduleId||blocked||Boolean(busy)}>Tạo Offer</button>
      </form>
      {moduleOffers.length?<p className={styles.hint}>{moduleOffers.map(item=>`${item.offerCode}: ${formatVnd(item.listPriceMinor)} · ${item.nominalUnits} units`).join(" · ")}</p>:null}
    </section>
    <section className={styles.createCard}>
      <div className={styles.sectionHead}><div><span>Student commercial</span><h3>Purchase / Upgrade</h3></div><small>UI luôn preflight Core Policy</small></div>
      <div className={styles.formGrid}>
        <label>Offer<select value={offerId} onChange={event=>{setOfferId(event.target.value);setSourceSubscriptionId("");}} disabled={blocked||Boolean(busy)}>
          <option value="">Chọn Offer</option>{catalog.data.offers.filter(item=>item.enabled).map(item=>{const specialtyModule=catalog.data.modules.find(module=>module.id===item.specialtyModuleId);return <option key={item.id} value={item.id}>{specialtyModule?.displayName??"Specialty"} · {item.offerCode} · {formatVnd(item.listPriceMinor)} · {item.nominalUnits} units</option>;})}
        </select></label>
        <label>Parent thanh toán<select value={payerId} onChange={event=>setPayerId(event.target.value)} disabled={blocked||Boolean(busy)}>
          <option value="">Chọn Parent</option>{lifecycle.guardians.filter(item=>item.parent.status==="ACTIVE").map(item=><option key={item.parent.id} value={item.parent.id}>{item.parent.displayName??item.parent.contacts[0]?.value??item.parent.id}</option>)}
        </select></label>
        <label>Source Subscription<select value={sourceSubscriptionId} onChange={event=>setSourceSubscriptionId(event.target.value)} disabled={blocked||Boolean(busy)}>
          <option value="">Không gắn Subscription</option>{purchaseSubscriptions.map(item=><option key={item.subscription.id} value={item.subscription.id}>{item.subscription.pathDisplayName} · {item.subscription.effectiveAvailableUnits} units</option>)}
        </select></label>
        <button type="button" disabled={!offerId||blocked||Boolean(busy)} onClick={()=>void preflight()}>Evaluate Policy</button>
        <button className={styles.primary} type="button" disabled={!offerId||!payerId||blocked||Boolean(busy)} onClick={()=>void purchase()}>Purchase</button>
      </div>
      {decision?<p className={styles.hint}>Policy: <b>{decision.policySource}</b> · {decision.allowed?"ALLOW":"DENY"} · source units {decision.sourceAvailableUnits??"n/a"}{decision.reasons.length?` · ${decision.reasons.join(", ")}`:""}</p>:null}
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Learner Specialty ledger</span><h3>Allocations</h3></div><small>Sessions không cần liên tục</small></div>
      {summary.data.allocations.length?summary.data.allocations.map(allocation=><AllocationCard key={allocation.id} allocation={allocation} sessions={sessionsForAllocation(allocation)} disabled={blocked||Boolean(busy)}
        onClaim={sessionId=>run(`claim:${allocation.id}`,()=>boApi.claimSpecialtySession(allocation.id,{sessionId,effectiveAt:new Date().toISOString()},crypto.randomUUID()),"Đã claim Specialty Session.",true)}
        onComplete={()=>run(`complete:${allocation.id}`,()=>boApi.completeSpecialtyAllocation(allocation.id,{effectiveAt:new Date().toISOString(),evidence:{source:"BO_V1_MANUAL"}},crypto.randomUUID()),"Đã complete Specialty.",true)}
        onFulfill={grantId=>run(`fulfill:${grantId}`,()=>boApi.fulfillSpecialtyPhysicalReward(grantId),"Đã ghi nhận phát phần thưởng.")}/>):<p className={styles.empty}>Student chưa có Specialty Allocation.</p>}
    </section>
  </section>;
}
function AllocationCard({allocation,sessions,disabled,onClaim,onComplete,onFulfill}:{
  allocation:BoSpecialtyStudentSummary["allocations"][number];sessions:BoSession[];disabled:boolean;
  onClaim:(sessionId:string)=>Promise<void>;onComplete:()=>Promise<void>;onFulfill:(grantId:string)=>Promise<void>;
}){
  const [sessionId,setSessionId]=useState("");
  return <article className={styles.subscription}>
    <div className={styles.subHead}><div><span>{allocation.offerMode}</span><strong>{allocation.specialtyName} · L{allocation.level}</strong><small>{formatVnd(allocation.priceMinor)} · Bill {allocation.billId.slice(0,8)}…</small></div>
      <div className={styles.balance}><strong>{allocation.remainingUnits}</strong><span>specialty units</span></div></div>
    <div className={styles.facts}><span>Claimed <b>{allocation.claimedUnits}/{allocation.allocatedUnits}</b></span><span>Source <b>{allocation.sourceSubscriptionId?"Subscription":"Standalone"}</b></span><span>Completion <b>{allocation.completion?"DONE":"OPEN"}</b></span></div>
    {!allocation.completion?<div className={styles.placement}><select value={sessionId} disabled={disabled} onChange={event=>setSessionId(event.target.value)}>
      <option value="">Chọn Session để claim</option>{sessions.map(item=><option key={item.id} value={item.id}>{item.localDate??item.startsAt} · {item.id.slice(0,8)}…</option>)}
    </select><button type="button" disabled={disabled||!sessionId||allocation.remainingUnits<=0} onClick={()=>void onClaim(sessionId)}>Claim session</button>
      <button type="button" disabled={disabled} onClick={()=>void onComplete()}>Complete manual</button></div>:null}
    {allocation.physicalRewards.map(item=>{
      const id=typeof item.id==="string"?item.id:"",status=typeof item.status==="string"?item.status:"";
      return <div key={id||JSON.stringify(item)} className={styles.actions}><span>Physical reward · {status}</span>{id&&status==="PENDING"?<button type="button" disabled={disabled} onClick={()=>void onFulfill(id)}>Đã phát</button>:null}</div>;
    })}
    {allocation.pinoriaRelics.length?<p className={styles.hint}>Pinoria Relic granted: {allocation.pinoriaRelics.length}</p>:null}
  </article>;
}
function integer(value:string,min:number){const result=Number(value);if(!Number.isSafeInteger(result)||result<min)throw new Error("Giá trị integer không hợp lệ.");return result;}
function money(value:string){return integer(value,0);}
function slug(value:string){const result=value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");if(!result)throw new Error("Code không hợp lệ.");return result;}
function formatVnd(value:number){return new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(value);}
function message(cause:unknown){return cause instanceof BoApiError?`${cause.message}${cause.requestId?` · ${cause.requestId}`:""}`:cause instanceof Error?cause.message:"Specialty operation failed.";}
