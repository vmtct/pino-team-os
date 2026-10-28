"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoBillSummary, BoLearnerLifecycle, BoPathProgram, BoPaymentMethod, BoPaymentTransactionKind, BoProductPlan, BoRunningClass, BoSaleResult } from "@/lib/bo-model";
import { suggestedContractSunday, amountFromPercent, percentFromAmount, quoteAfterDiscounts, type DiscountInputMode } from "@/lib/bo-subscription-create-ux";
import {validateRegistrationDates,existingRegistrationPlacements} from "@/lib/bo-subscription-finalization";
import styles from "./bo-subscriptions.module.css";

export type BillingReplayAttempt = { key: string; idempotencyKey: string; action: (key: string) => Promise<unknown>; success: string };
export type BillingReplayState = { pending: BillingReplayAttempt | null; busy: string | null; notice: string | null; error: string | null };
type Props = {
  lifecycle: BoLearnerLifecycle;
  paths: BoPathProgram[];
  classes: BoRunningClass[];
  onChanged: () => Promise<void>;
  replayState: BillingReplayState;
  setReplayState: React.Dispatch<React.SetStateAction<BillingReplayState>>;
  createOnly?: boolean;
};
const TERMS = [12, 24, 48] as const;
const CADENCES = [1, 2, 3, 4, 5, 6] as const;

export function authoritativePlacementCenterId(placements: string[], eligibleClasses: BoRunningClass[]) {
  if (!placements.length) throw new Error("Chưa có Running Class để xác định Center.");
  const selected = placements.map((runningClassId) => eligibleClasses.find((item) => item.id === runningClassId) ?? null);
  if (selected.some((item) => !item?.centerId)) throw new Error("Running Classes đã chọn phải có Center hợp lệ.");
  const centerIds = [...new Set(selected.map((item) => item!.centerId!))];
  if (centerIds.length !== 1) throw new Error("Các Running Classes đã chọn phải thuộc cùng một Center.");
  return centerIds[0]!;
}

export function BillingWorkspace({ lifecycle, paths, classes, onChanged, replayState, setReplayState, createOnly = false }: Props) {
  const [plans, setPlans] = useState<BoProductPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [pathId, setPathId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [startsOn, setStartsOn] = useState(today());
  const [contractEndsOn, setContractEndsOn] = useState(() => suggestedContractSunday(today(), 12));
  const [placementStartsOn, setPlacementStartsOn] = useState(today());
  const [itemDiscount, setItemDiscount] = useState("0");
  const [billDiscount, setBillDiscount] = useState("0");
  const [itemRate, setItemRate] = useState("0");
  const [billRate, setBillRate] = useState("0");
  const [itemMode, setItemMode] = useState<DiscountInputMode>("amount");
  const [billMode, setBillMode] = useState<DiscountInputMode>("amount");
  const [endManual, setEndManual] = useState(false);
  const [dueOn, setDueOn] = useState("");
  const [campaign, setCampaign] = useState("");
  const [latestSale, setLatestSale] = useState<BoSaleResult | null>(null);
  const [placements, setPlacements] = useState<string[]>([]);
  const [placementEntryTimes, setPlacementEntryTimes] = useState<string[]>([]);
  const [placementDurations, setPlacementDurations] = useState<string[]>([]);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const commandFence = useRef(false);
  const { pending, busy, notice, error } = replayState;
  const setPending = (pending: BillingReplayAttempt | null) => setReplayState((state) => ({ ...state, pending }));
  const setBusy = (busy: string | null) => setReplayState((state) => ({ ...state, busy }));
  const setNotice = (notice: string | null) => setReplayState((state) => ({ ...state, notice }));
  const setError = (error: string | null) => setReplayState((state) => ({ ...state, error }));
  const [billRevision, setBillRevision] = useState(0);

  async function loadPlans() {
    const next = await boApi.billingProductPlans();
    setPlans(next);
    setPlanId((current) => {
      const available = next.filter((plan) => plan.enabled && (!createOnly || (plan.termWeeks === 12 && plan.cadence >= 1 && plan.cadence <= 3)));
      return available.some((plan) => plan.id === current) ? current
        : available.find((plan) => plan.badge === "HERO")?.id ?? available[0]?.id ?? "";
    });
  }

  useEffect(() => { void loadPlans().catch((value) => setError(message(value))); }, []);
  useEffect(() => {
    const availablePaths = paths.filter((path) => path.status === "ACTIVE" &&
      (!createOnly || ["artchitect","pianohouse","little-piner-art","little-piner-piano"].includes(path.code)));
    setPathId((current) => availablePaths.some((path) => path.id === current)
      ? current : availablePaths[0]?.id ?? "");
    setPayerId(lifecycle.guardians.find((item) => item.parent.status === "ACTIVE")?.parent.id ?? "");
  }, [lifecycle.student.id, lifecycle.guardians, paths]);

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;
  const sellablePlans = plans.filter((plan) => plan.enabled && (!createOnly || (plan.termWeeks === 12 && plan.cadence >= 1 && plan.cadence <= 3)));
  const sellablePaths = paths.filter((path) => path.status === "ACTIVE" &&
    (!createOnly || ["artchitect","pianohouse","little-piner-art","little-piner-piano"].includes(path.code)));
  const selectedGross = selectedPlan?.listPriceMinor ?? 0;
  const billBase = Math.max(0, selectedGross - Number(itemDiscount || 0));
  const quoted = quoteAfterDiscounts(selectedGross, Number(itemDiscount), Number(billDiscount));

  function changeItemAmount(raw: string) {
    setItemMode("amount"); setItemDiscount(raw);
    setItemRate(String(percentFromAmount(selectedGross, Number(raw))));
    if (billMode === "percent") setBillDiscount(String(amountFromPercent(Math.max(0, selectedGross - Number(raw)), Number(billRate))));
    else setBillRate(String(percentFromAmount(Math.max(0, selectedGross - Number(raw)), Number(billDiscount))));
  }
  function changeItemRate(raw: string) {
    setItemMode("percent"); setItemRate(raw);
    const next = amountFromPercent(selectedGross, Number(raw));setItemDiscount(String(next));
    if (billMode === "percent") setBillDiscount(String(amountFromPercent(Math.max(0, selectedGross - next), Number(billRate))));
    else setBillRate(String(percentFromAmount(Math.max(0, selectedGross - next), Number(billDiscount))));
  }
  function changeBillAmount(raw: string) {
    setBillMode("amount");setBillDiscount(raw);setBillRate(String(percentFromAmount(billBase, Number(raw))));
  }
  function changeBillRate(raw: string) {
    setBillMode("percent");setBillRate(raw);setBillDiscount(String(amountFromPercent(billBase, Number(raw))));
  }
  function changeStart(value: string) {
    setStartsOn(value);
    if (!endManual) setContractEndsOn(suggestedContractSunday(value, selectedPlan?.termWeeks ?? 12));
    if (!commercialLocked) setPlacementStartsOn(maxLocalDate(value, today()));
  }

  useEffect(() => {
    if (!createOnly) return;
    const gross = selectedPlan?.listPriceMinor ?? 0;
    const item = itemMode === "percent" ? amountFromPercent(gross, Number(itemRate)) : Number(itemDiscount);
    const boundedItem = Number.isFinite(item) ? item : 0;
    if (itemMode === "percent") setItemDiscount(String(boundedItem));
    else setItemRate(String(percentFromAmount(gross, boundedItem)));
    const remaining = Math.max(0, gross - boundedItem);
    if (billMode === "percent") setBillDiscount(String(amountFromPercent(remaining, Number(billRate))));
    else setBillRate(String(percentFromAmount(remaining, Number(billDiscount))));
    if (!endManual && selectedPlan) setContractEndsOn(suggestedContractSunday(startsOn, selectedPlan.termWeeks));
    // Recalculate only when selecting another Product Plan; input handlers handle discount edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.id, selectedPlan?.listPriceMinor]);
  useEffect(() => {
    setLatestSale(null);
    setRegistrationComplete(false);
    setPlacements([]);
    setPlacementEntryTimes([]);
    setPlacementDurations([]);
    setPlacementStartsOn(today());
  }, [lifecycle.student.id]);
  useEffect(() => {
    const count = selectedPlan?.cadence ?? 0;
    setPlacements((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
    setPlacementEntryTimes((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
    setPlacementDurations((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
    if (!latestSale) setRegistrationComplete(false);
  }, [selectedPlan?.id]);
  useEffect(() => {
    // A recovered Core sale already owns its placement choices; changing Path during hydrate must not erase them.
    if (latestSale) return;
    const count = selectedPlan?.cadence ?? 0;
    setPlacements(Array.from({ length: count }, () => ""));
    setPlacementEntryTimes(Array.from({ length: count }, () => ""));
    setPlacementDurations(Array.from({ length: count }, () => ""));
    if (!latestSale) setRegistrationComplete(false);
  }, [pathId]);
  const eligibleClasses = useMemo(() => classes.filter((item) => item.status === "ACTIVE" && item.pathProgramId === pathId), [classes, pathId]);
  const pendingRegistrationEntries = useMemo(() => lifecycle.subscriptions.filter((entry) => {
    const sub = entry.subscription;
    return (sub.lifecycle === "DRAFT" || (sub.lifecycle === "ACTIVE" && entry.enrollments.length === 0))
      && Boolean(sub.productPlanId && sub.contractualStartsOn)
      && /^bill:[0-9a-f-]{36}$/.test(sub.commercialReference ?? "");
  }), [lifecycle.subscriptions]);
  const selectedPlacementCount = placements.filter(Boolean).length;
  const placementIds = placements.filter(Boolean);
  const placementDetailsReady = placements.every((runningClassId, index) => {
    if (!runningClassId) return false;
    const runningClass = eligibleClasses.find((item) => item.id === runningClassId);
    if (!runningClass) return false;
    if (runningClass.deliveryTopology !== "FLEXIBLE_STUDIO") return true;
    const duration = Number(placementDurations[index]);
    return Boolean(placementEntryTimes[index]) && Number.isInteger(duration) && duration > 0;
  });
  const placementsReady = Boolean(selectedPlan) && selectedPlacementCount === selectedPlan!.cadence && new Set(placementIds).size === placementIds.length && placementDetailsReady;
  const commercialLocked = Boolean(latestSale && !registrationComplete);
  const billIds = useMemo(() => [...new Set(lifecycle.subscriptions
    .map((entry) => /^bill:([0-9a-f-]{36})$/.exec(entry.subscription.commercialReference ?? "")?.[1] ?? null)
    .filter((value): value is string => Boolean(value)))], [lifecycle.subscriptions]);

  async function execute(attempt: BillingReplayAttempt) {
    if (busy) return;
    setBusy(attempt.key); setNotice(null); setError(null);
    try {
      await attempt.action(attempt.idempotencyKey);
      setPending(null); setBillRevision((value) => value + 1);
      await Promise.all([loadPlans(), onChanged()]);
      setNotice(attempt.success);
    } catch (value) {
      const rejected = value instanceof BoApiError && value.structuredResponse && value.status >= 400 && value.status < 500;
      if (rejected) setPending(null);
      setError(message(value));
    } finally { setBusy(null); }
  }

  async function runReplay(key: string, action: (idempotencyKey: string) => Promise<unknown>, success: string) {
    // Guard before React re-renders: simultaneous submits must share, not mint, a Sale key.
    if (commandFence.current || busy) return;
    commandFence.current = true;
    try {
      if (pending) { if (pending.key === key) await execute(pending); return; }
      const attempt = { key, idempotencyKey: crypto.randomUUID(), action, success };
      setPending(attempt); await execute(attempt);
    } finally { commandFence.current = false; }
  }

  function bulkBody(sale: BoSaleResult) {
    return {
      subscriptions: [{
        subscriptionId: sale.subscriptionId,
        expectedPathProgramId: pathId,
        expectedWeeklyCommitment: sale.productPlan.cadence,
        placements: placements.map((runningClassId, index) => {
          const runningClass = eligibleClasses.find((item) => item.id === runningClassId);
          if (!runningClass) throw new Error("Running Class không còn hợp lệ cho Path đã chọn.");
          const base = { runningClassId, effectiveFromLocalDate: placementStartsOn };
          if (runningClass.deliveryTopology !== "FLEXIBLE_STUDIO") return base;
          const duration = Number(placementDurations[index]);
          if (!placementEntryTimes[index] || !Number.isInteger(duration) || duration <= 0) throw new Error("Flexible Studio cần giờ vào và duration hợp lệ.");
          return { ...base, plannedEntryLocalTime: placementEntryTimes[index], plannedDurationMinutes: duration };
        }),
      }],
      pendingSubscriptions: [],
      commandEffectiveLocalDate: today(),
    };
  }

  async function placeRegistration(sale: BoSaleResult, idempotencyKey: string, policyEffectiveAt: string) {
    const body = { ...bulkBody(sale), policyEffectiveAt };
    const preflight = await boApi.preflightBulkEnrollments(body);
    if (preflight.enrollments !== sale.productPlan.cadence) throw new Error("Bulk preflight không khớp cadence của Product Plan.");
    return boApi.placeBulkEnrollments(body, idempotencyKey);
  }

  async function resumePendingRegistration(entry: BoLearnerLifecycle["subscriptions"][number]) {
    if (busy || pending) return;
    const sub = entry.subscription;
    const billId = /^bill:([0-9a-f-]{36})$/.exec(sub.commercialReference ?? "")?.[1] ?? null;
    const plan = plans.find((item) => item.id === sub.productPlanId) ?? null;
    if (!billId || !plan || !sub.contractualStartsOn || sub.weeklyCommitment !== plan.cadence) {
      setError("Pending registration không khớp canonical Product Plan/Bill snapshot.");
      return;
    }
    setBusy(`recover:${sub.id}`); setNotice(null); setError(null);
    try {
      const bill = await boApi.billingBill(billId);
      const billItem = bill.items.find((item) => item.subscriptionId === sub.id);
      if (!billItem || billItem.productPlanId !== plan.id || billItem.studentProfileId !== lifecycle.student.id) {
        throw new Error("Pending registration Bill snapshot không khớp Subscription.");
      }
      setPlanId(plan.id);
      setPathId(sub.pathProgramId);
      setPayerId(bill.bill.payerParentUserId);
      setStartsOn(sub.contractualStartsOn);
      setContractEndsOn(sub.contractualEndsOn ?? "");
      const resumeDate=maxLocalDate(sub.contractualStartsOn,today());
      setPlacementStartsOn(resumeDate);
      const eligible=new Set(classes.filter(c=>c.status==="ACTIVE"&&c.pathProgramId===sub.pathProgramId).map(c=>c.id));
      const placed=existingRegistrationPlacements(entry.enrollments,resumeDate,eligible);
      setPlacements(Array.from({length:plan.cadence},(_,index)=>placed[index]??""));
      setPlacementEntryTimes(Array.from({ length: plan.cadence }, () => ""));
      setPlacementDurations(Array.from({ length: plan.cadence }, () => ""));
      setLatestSale({
        productPlan: plan,
        bill,
        billItem,
        subscriptionId: sub.id,
        contractualStartsOn: sub.contractualStartsOn,
        contractualEndsOn: sub.contractualEndsOn,
        purchasedUnits: plan.purchasedUnits,
      });
      setRegistrationComplete(false);
      setNotice(`Đã khôi phục Subscription ${sub.id.slice(0,8)}…; chọn đủ ${plan.cadence} Running Classes để hoàn tất placement.`);
    } catch (value) {
      setError(message(value));
    } finally {
      setBusy(null);
    }
  }

  async function ensureActivation(subscriptionId:string,serviceStartsOn:string){
    const sub=await boApi.subscriptionById(subscriptionId);
    if(sub.lifecycle==="ACTIVE")return;
    if(sub.lifecycle!=="DRAFT")throw new Error("Subscription lifecycle is not eligible for activation.");
    const placement=await boApi.subscriptionPlacement(subscriptionId,serviceStartsOn);
    if(placement.placementState!=="PLACED"||placement.effectiveEnrollmentCount!==placement.weeklySessionCommitment)
      throw new Error("Core has not verified complete placement at the service start date.");
    await boApi.activateSubscription(subscriptionId,{serviceStartsOn,expectedVersion:sub.version},crypto.randomUUID());
  }

  async function finalizeRegistration(sale:BoSaleResult,key:string,policyEffectiveAt:string,serviceStartsOn:string){
    const placement=await boApi.subscriptionPlacement(sale.subscriptionId,serviceStartsOn);
    if(placement.placementState!=="PLACED"||placement.effectiveEnrollmentCount!==sale.productPlan.cadence)
      await placeRegistration(sale,key,policyEffectiveAt);
    await ensureActivation(sale.subscriptionId,serviceStartsOn);
    const [sub,confirmed]=await Promise.all([boApi.subscriptionById(sale.subscriptionId),boApi.subscriptionPlacement(sale.subscriptionId,serviceStartsOn)]);
    if(sub.lifecycle!=="ACTIVE"||confirmed.placementState!=="PLACED"||confirmed.effectiveEnrollmentCount!==sale.productPlan.cadence)
      throw new Error("Core readback is incomplete. Resume existing registration rather than creating a new sale.");
  }

  async function submitRegistration(event: React.FormEvent) {
    event.preventDefault();
    if (!planId || !pathId || !payerId || !selectedPlan) { setError("Chọn Product Plan, Path và Parent thanh toán."); return; }
    if (createOnly && !sellablePaths.some((path) => path.id === pathId)) {setError("Path không thuộc danh mục thương mại được duyệt.");return;}
    if (createOnly && !sellablePlans.some((plan) => plan.id === selectedPlan.id)) {setError("Product Plan chưa được phép bán trong form này.");return;}
    const dateError=validateRegistrationDates(startsOn,placementStartsOn,contractEndsOn);
    if(dateError){setError(dateError);return;}
    if (!quoted.valid || !Number.isFinite(Number(itemRate)) || !Number.isFinite(Number(billRate)) ||
        Number(itemRate) < 0 || Number(itemRate) > 100 || Number(billRate) < 0 || Number(billRate) > 100) {
      setError("Giảm giá không hợp lệ hoặc vượt giá trị còn lại.");return;
    }
    if (!lifecycle.guardians.some((x) => x.parent.id === payerId && x.parent.status === "ACTIVE")) {
      setError("Parent thanh toán phải đang hoạt động và liên kết với học viên.");return;
    }
    if (pendingRegistrationEntries.length) { setError("Student đã có Subscription Product Plan chưa placement. Hãy resume placement hiện hữu trước khi tạo sale mới."); return; }
    if (!placementsReady) { setError(`Chọn đủ ${selectedPlan.cadence} Running Classes khác nhau trước khi đăng ký.`); return; }
    if (registrationComplete) {setError("Registration đã hoàn tất. Đóng drawer và mở lại để tạo gói khác.");return;}
    if (latestSale && !registrationComplete) { setError("Subscription đã tạo; hãy hoàn tất placement, không tạo sale mới."); return; }
    let centerId: string;
    try { centerId = authoritativePlacementCenterId(placements, eligibleClasses); }
    catch (value) { setError(message(value)); return; }
    const policyEffectiveAt = new Date().toISOString();
    await runReplay("registration", async (idempotencyKey) => {
      const sale = await boApi.createBillingSale({
        payerParentUserId: payerId, studentProfileId: lifecycle.student.id, pathProgramId: pathId, centerId,
        productPlanId: planId, contractualStartsOn: startsOn, contractualEndsOn: contractEndsOn || null, deferActivation: true,
        itemDiscountMinor: money(itemDiscount), billDiscountMinor: money(billDiscount),
        ...(dueOn ? { dueOn } : {}), ...(campaign.trim() ? { campaignReference: campaign.trim() } : {}),
      }, idempotencyKey);
      setLatestSale(sale);
      await finalizeRegistration(sale,idempotencyKey+":placement",policyEffectiveAt,placementStartsOn);
      setRegistrationComplete(true);
      return sale;
    }, `Đã tạo Subscription và xếp đủ ${selectedPlan.cadence}/${selectedPlan.cadence} Running Classes.`);
  }

  async function retryPlacement() {
    if (!latestSale || !selectedPlan || !placementsReady) { setError("Chọn lại đủ Running Classes trước khi retry placement."); return; }
    const policyEffectiveAt = new Date().toISOString();
    await runReplay(`placement:${latestSale.subscriptionId}`, async (idempotencyKey) => {
      await finalizeRegistration(latestSale,idempotencyKey,policyEffectiveAt,placementStartsOn);
      setRegistrationComplete(true);
      return latestSale;
    }, `Đã hoàn tất placement ${selectedPlan.cadence}/${selectedPlan.cadence} cho Subscription hiện hữu.`);
  }

  async function configure(plan: BoProductPlan) {
    if (busy) return;
    const raw = window.prompt("Giá niêm yết VND", String(plan.listPriceMinor));
    if (raw === null) return;
    const badgeRaw = window.prompt("Badge: ENTRY / HERO / STANDARD", plan.badge)?.trim().toUpperCase();
    if (badgeRaw !== "ENTRY" && badgeRaw !== "HERO" && badgeRaw !== "STANDARD") { setError("Badge không hợp lệ."); return; }
    const enabled = window.confirm("OK = đang bán; Cancel = tạm ẩn plan.");
    setBusy(`plan:${plan.id}`); setError(null);
    try {
      await boApi.updateBillingProductPlan(plan.id, { listPriceMinor: money(raw), enabled, badge: badgeRaw, expectedVersion: plan.version });
      await loadPlans(); setNotice("Đã cập nhật Product Plan config.");
    } catch (value) {
      await loadPlans().catch(() => undefined);
      setError(message(value));
    } finally { setBusy(null); }
  }

  async function transact(billId: string, kind: BoPaymentTransactionKind) {
    const raw = window.prompt(kind === "PAYMENT" ? "Số tiền thu (VND)" : "Số tiền hoàn (VND)");
    if (!raw) return;
    const methodRaw = window.prompt("Phương thức: CASH / BANK_TRANSFER / CARD / OTHER", "BANK_TRANSFER")?.trim().toUpperCase();
    if (!isMethod(methodRaw)) { setError("Phương thức thanh toán không hợp lệ."); return; }
    const transactionBody = {
      transactionKind: kind, amountMinor: money(raw), occurredAt: new Date().toISOString(), method: methodRaw,
    };
    await runReplay(`${kind}:${billId}`, (idempotencyKey) => boApi.recordBillingTransaction(billId, transactionBody, idempotencyKey),
      kind === "PAYMENT" ? "Đã ghi nhận thanh toán." : "Đã ghi nhận hoàn tiền.");
  }

  return <section className={styles.billingStack}>
    {notice ? <div className={styles.notice}>{notice}</div> : null}
    {error ? <div className={styles.error}>{error}{pending ? <><br/><button type="button" onClick={() => void execute(pending)}>Retry exact command</button></> : null}</div> : null}

    {!createOnly ? <section className={styles.createCard}>
      <div className={styles.sectionHead}><div><span>Commercial config</span><h3>Product Plans · 6 × 3</h3></div><small>Cadence/term immutable · price/badge/availability configurable</small></div>
      <div className={styles.planMatrix}>
        <div className={styles.planCorner}>buổi/tuần</div>
        {TERMS.map((term) => <strong key={term}>{term} tuần</strong>)}
        {CADENCES.flatMap((cadence) => [
          <strong key={`c-${cadence}`}>{cadence}</strong>,
          ...TERMS.map((term) => {
            const plan = plans.find((item) => item.cadence === cadence && item.termWeeks === term);
            return <button key={`${cadence}-${term}`} type="button" disabled={!plan || Boolean(busy || pending)}
              className={plan?.badge === "HERO" ? styles.planHero : plan?.badge === "ENTRY" ? styles.planEntry : styles.planCell}
              onClick={() => plan && void configure(plan)}>
              {plan ? <><b>{formatVnd(plan.listPriceMinor)}</b><small>{plan.purchasedUnits} buổi · {plan.badge}{plan.enabled ? "" : " · OFF"}</small></> : "—"}
            </button>;
          }),
        ])}
      </div>
    </section> : null}

    {!latestSale && pendingRegistrationEntries.length ? <section className={styles.registrationPending}>
      <strong>Pending Running Class placement</strong>
      <p>Canonical Subscription đã tồn tại nhưng chưa có Enrollment. Resume placement hiện hữu; không tạo sale thứ hai.</p>
      {pendingRegistrationEntries.map((entry) => <button key={entry.subscription.id} type="button" disabled={Boolean(busy || pending)} onClick={() => void resumePendingRegistration(entry)}>
        {busy === `recover:${entry.subscription.id}` ? "Đang khôi phục…" : `Resume ${entry.subscription.pathDisplayName} · ${entry.subscription.weeklyCommitment} buổi/tuần`}
      </button>)}
    </section> : null}

    <form className={createOnly ? styles.createFormShell : styles.createCard} onSubmit={(event) => void submitRegistration(event)}>
      <div className={styles.sectionHead}><div><span>New registration</span><h3>Tạo Subscription + Running Class placement</h3></div><small>Cadence từ Product Plan · chỉ complete sau bulk placement</small></div>
      <div className={createOnly ? styles.createFormGrid : styles.formGrid}>
        <label>Product Plan<select className={createOnly ? "edit-input" : undefined} required disabled={Boolean(busy || pending || commercialLocked)} value={planId} onChange={(event) => setPlanId(event.target.value)}>
          <option value="">Chọn plan</option>{sellablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.cadence}×/tuần · {plan.termWeeks} tuần · {formatVnd(plan.listPriceMinor)} {plan.badge === "HERO" ? "· HERO" : plan.badge === "ENTRY" ? "· ENTRY" : ""}</option>)}
        </select></label>
        <label>Path<select className={createOnly ? "edit-input" : undefined} required disabled={Boolean(busy || pending || commercialLocked)} value={pathId} onChange={(event) => setPathId(event.target.value)}>
          <option value="">Chọn Path</option>{sellablePaths.map((path) => <option key={path.id} value={path.id}>{path.displayName}</option>)}
        </select></label>
        <label>Parent thanh toán<select className={createOnly ? "edit-input" : undefined} required disabled={Boolean(busy || pending || commercialLocked)} value={payerId} onChange={(event) => setPayerId(event.target.value)}>
          <option value="">Chọn Parent</option>{lifecycle.guardians.filter((item) => item.parent.status === "ACTIVE").map((item) => <option key={item.parent.id} value={item.parent.id}>{item.parent.displayName ?? item.parent.contacts[0]?.value ?? item.parent.id}</option>)}
        </select></label>
        <label>Contract starts<input className={createOnly ? "edit-input" : undefined} type="date" required disabled={Boolean(busy || pending || commercialLocked)} value={startsOn} onChange={(event) => changeStart(event.target.value)} /></label>
        <label>Ngày kết thúc hợp đồng<input className={createOnly ? "edit-input" : undefined} type="date" required min={startsOn} disabled={Boolean(busy || pending || commercialLocked)} value={contractEndsOn} onChange={(event) => {setEndManual(true);setContractEndsOn(event.target.value);}} />
          {createOnly ? <button type="button" className={styles.suggestionReset} disabled={Boolean(busy || pending || commercialLocked)} onClick={() => {setEndManual(false);setContractEndsOn(suggestedContractSunday(startsOn, selectedPlan?.termWeeks ?? 12));}}>Đặt lại ngày gợi ý</button> : null}</label>
        <label>Giảm giá sản phẩm{createOnly ? <span className={styles.discountPair}><span><small>VNĐ</small><input className={createOnly ? "edit-input" : undefined} aria-label="Giảm giá sản phẩm VNĐ" type="number" min="0" step="1" disabled={Boolean(busy || pending || commercialLocked)} value={itemDiscount} onChange={(event) => changeItemAmount(event.target.value)} /></span><span><small>%</small><input className={createOnly ? "edit-input" : undefined} aria-label="Giảm giá sản phẩm phần trăm" type="number" min="0" max="100" step="0.01" disabled={Boolean(busy || pending || commercialLocked)} value={itemRate} onChange={(event) => changeItemRate(event.target.value)} /></span></span> : <input className={createOnly ? "edit-input" : undefined} type="number" min="0" disabled={Boolean(busy || pending || commercialLocked)} value={itemDiscount} onChange={(event) => setItemDiscount(event.target.value)} />}</label>
        <label>Giảm giá Bill{createOnly ? <span className={styles.discountPair}><span><small>VNĐ</small><input className={createOnly ? "edit-input" : undefined} aria-label="Giảm giá Bill VNĐ" type="number" min="0" step="1" disabled={Boolean(busy || pending || commercialLocked)} value={billDiscount} onChange={(event) => changeBillAmount(event.target.value)} /></span><span><small>%</small><input className={createOnly ? "edit-input" : undefined} aria-label="Giảm giá Bill phần trăm" type="number" min="0" max="100" step="0.01" disabled={Boolean(busy || pending || commercialLocked)} value={billRate} onChange={(event) => changeBillRate(event.target.value)} /></span></span> : <input className={createOnly ? "edit-input" : undefined} type="number" min="0" disabled={Boolean(busy || pending || commercialLocked)} value={billDiscount} onChange={(event) => setBillDiscount(event.target.value)} />}</label>
        <label>Due date<input className={createOnly ? "edit-input" : undefined} type="date" disabled={Boolean(busy || pending || commercialLocked)} value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
        <label>Campaign<input className={createOnly ? "edit-input" : undefined} disabled={Boolean(busy || pending || commercialLocked)} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Tuỳ chọn" /></label>
      </div>
      {selectedPlan ? <>
        <p className={styles.hint}>Core plan: {selectedPlan.cadence} buổi/tuần · {selectedPlan.termWeeks} tuần · {selectedPlan.purchasedUnits} units. {createOnly ? "Ngày kết thúc được gợi ý theo Chủ nhật, có thể sửa tay; Core nhận ngày HĐ đã chọn." : "Core xác nhận giá, thời hạn và units."}</p>
        {createOnly ? <div className={styles.createPreview} aria-live="polite">
          <span>Giá niêm yết <strong>{formatVnd(quoted.gross)}</strong></span>
          <span>Giảm giá SP <strong>−{formatVnd(Number(itemDiscount))}</strong></span>
          <span>Tạm tính <strong>{formatVnd(quoted.afterItem)}</strong></span>
          <span>Giảm giá Bill <strong>−{formatVnd(Number(billDiscount))}</strong></span>
          <span className={styles.createPreviewTotal}>Dự kiến <strong>{quoted.valid ? formatVnd(quoted.net) : "Giảm giá không hợp lệ"}</strong></span>
          <small>Giá trị preview chỉ để đối chiếu; Core Bill snapshot quyết định số tiền cuối.</small>
        </div> : null}
        <div className={styles.placementWizard}>
          <div className={styles.sectionHead}><div><span>Recurring placement</span><h3>Chọn đúng {selectedPlan.cadence} Running Classes đã tạo sẵn</h3></div><small>{selectedPlacementCount}/{selectedPlan.cadence} assigned · capacity được Core preflight</small></div>
          <p className={styles.hint}>Mỗi Running Class = 1 weekly slot. Chỉ hiện lớp ACTIVE cùng Path; một lớp không thể chiếm hai slot của cùng Subscription.</p>
          <label className={styles.placementDate}>Placement starts<input className={createOnly ? "edit-input" : undefined} type="date" min={maxLocalDate(startsOn,today())} disabled={Boolean(busy || pending || registrationComplete)} value={placementStartsOn} onChange={(event) => setPlacementStartsOn(event.target.value)} /></label>
          <div className={styles.placementSlots}>{placements.map((value, index) => {
            const selectedClass = eligibleClasses.find((item) => item.id === value) ?? null;
            return <label className={styles.placementSlot} key={index}>
              <span>Recurring seat {index + 1}</span>
              <select className={createOnly ? "edit-input" : undefined} disabled={Boolean(busy || pending || registrationComplete)} value={value} onChange={(event) => {
                const classId = event.target.value;
                const runningClass = eligibleClasses.find((item) => item.id === classId) ?? null;
                setPlacements((current) => current.map((item, position) => position === index ? classId : item));
                setPlacementEntryTimes((current) => current.map((item, position) => position === index ? (runningClass?.deliveryTopology === "FLEXIBLE_STUDIO" ? runningClass.startLocalTime : "") : item));
                setPlacementDurations((current) => current.map((item, position) => position === index ? (runningClass?.deliveryTopology === "FLEXIBLE_STUDIO" ? String(runningClass.defaultParticipationMinutes ?? "") : "") : item));
              }}>
                <option value="">Chọn Running Class</option>
                {eligibleClasses.map((item) => {
                  const usedElsewhere = placements.some((selected, position) => position !== index && selected === item.id);
                  return <option key={item.id} value={item.id} disabled={usedElsewhere}>{item.name} · {classSchedule(item)}</option>;
                })}
              </select>
              {selectedClass?.deliveryTopology === "FLEXIBLE_STUDIO" ? <span className={styles.flexiblePlacement}>
                <span>Entry time<input className={createOnly ? "edit-input" : undefined} type="time" disabled={Boolean(busy || pending || registrationComplete)} value={placementEntryTimes[index] ?? ""} onChange={(event) => setPlacementEntryTimes((current) => current.map((item, position) => position === index ? event.target.value : item))} /></span>
                <span>Duration (min)<input className={createOnly ? "edit-input" : undefined} type="number" min="1" disabled={Boolean(busy || pending || registrationComplete)} value={placementDurations[index] ?? ""} onChange={(event) => setPlacementDurations((current) => current.map((item, position) => position === index ? event.target.value : item))} /></span>
              </span> : null}
            </label>;
          })}</div>
          {!eligibleClasses.length ? <p className={styles.registrationPending}>Chưa có Running Class ACTIVE cùng Path. Tạo Running Class ở Delivery trước khi đăng ký.</p> : null}
        </div>
      </> : null}
      {latestSale && !registrationComplete ? <p className={styles.registrationPending}>Subscription {latestSale.subscriptionId.slice(0,8)}… đã tạo nhưng placement chưa hoàn tất. Có thể đổi Running Classes rồi retry placement; không tạo sale thứ hai.</p> : null}
      {registrationComplete && latestSale ? <p className={styles.registrationSuccess}>Registration complete · Enrollment {latestSale.productPlan.cadence}/{latestSale.productPlan.cadence} · Bill {latestSale.bill.bill.id.slice(0,8)}… · {latestSale.purchasedUnits} units.</p> : null}
      {latestSale && !registrationComplete
        ? <button className={createOnly ? "primary-btn" : styles.primary} disabled={Boolean(busy || pending || !placementsReady)} type="button" onClick={() => void retryPlacement()}>{busy?.startsWith("placement:") ? "Đang preflight/placement…" : `Hoàn tất placement ${selectedPlacementCount}/${selectedPlan?.cadence ?? 0}`}</button>
        : <button className={createOnly ? "primary-btn" : styles.primary} disabled={Boolean(busy || pending || !placementsReady || registrationComplete)} type="submit">{busy === "registration" ? "Đang tạo + preflight + placement…" : registrationComplete ? "Đăng ký hoàn tất" : `Confirm registration ${selectedPlacementCount}/${selectedPlan?.cadence ?? 0}`}</button>}
      {latestSale ? <p className={styles.saleResult}>Bill {latestSale.bill.bill.id.slice(0,8)}… · {latestSale.purchasedUnits} units · contract {latestSale.contractualStartsOn} → {latestSale.contractualEndsOn}</p> : null}
    </form>

    {!createOnly && billIds.length ? <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Financial ledger</span><h3>Bills</h3></div><small>Payment/Refund là transaction riêng; Subscription không phụ thuộc trạng thái PAID</small></div>
      <div className={styles.billGrid}>{billIds.map((billId) => <BillCard key={billId} billId={billId} revision={billRevision} disabled={Boolean(busy || pending)} onTransaction={transact} />)}</div>
    </section> : null}
  </section>;
}

function BillCard({ billId, revision, disabled, onTransaction }: { billId: string; revision: number; disabled: boolean; onTransaction: (id: string, kind: BoPaymentTransactionKind) => Promise<void> }) {
  const [summary, setSummary] = useState<BoBillSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void boApi.billingBill(billId).then((value) => { if (active) { setSummary(value); setError(null); } }).catch((value) => { if (active) setError(message(value)); }); return () => { active = false; }; }, [billId, revision]);
  if (error) return <article className={styles.billCard}><span>{error}</span></article>;
  if (!summary) return <article className={styles.billCard}><span>Đang tải Bill…</span></article>;
  return <article className={styles.billCard}>
    <div><strong>{summary.paymentState}{summary.isOverdue ? " · OVERDUE" : ""}</strong><small>{summary.bill.dueOn ? `Due ${summary.bill.dueOn}` : "Không có due date"}</small></div>
    <div className={styles.billAmounts}><span>Net <b>{formatVnd(summary.netAmountMinor)}</b></span><span>Đã thu <b>{formatVnd(summary.collectedAmountMinor)}</b></span><span>Còn <b>{formatVnd(summary.balanceMinor)}</b></span></div>
    <div className={styles.actions}><button type="button" disabled={disabled || summary.paymentState === "VOID"} onClick={() => void onTransaction(billId, "PAYMENT")}>Thu tiền</button><button type="button" disabled={disabled || summary.collectedAmountMinor <= 0 || summary.paymentState === "VOID"} onClick={() => void onTransaction(billId, "REFUND")}>Hoàn tiền</button></div>
  </article>;
}

function isMethod(value: string | undefined): value is BoPaymentMethod { return value === "CASH" || value === "BANK_TRANSFER" || value === "CARD" || value === "OTHER"; }
function money(value: string): number { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Số tiền phải là số nguyên VND không âm."); return parsed; }
function formatVnd(value: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
function classSchedule(item: BoRunningClass) { const days = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"]; return `${days[item.recurrenceWeekdays[0] ?? 0] ?? ""} ${item.startLocalTime}–${item.endLocalTime}`; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function maxLocalDate(left: string, right: string) { return left >= right ? left : right; }
function message(value: unknown) { return value instanceof Error ? value.message : "Billing operation failed."; }
