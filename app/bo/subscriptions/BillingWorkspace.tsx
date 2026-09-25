"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoBillSummary, BoLearnerLifecycle, BoPathProgram, BoPaymentMethod, BoPaymentTransactionKind, BoProductPlan, BoRunningClass, BoSaleResult } from "@/lib/bo-model";
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
};
const TERMS = [12, 24, 48] as const;
const CADENCES = [1, 2, 3, 4, 5, 6] as const;

export function BillingWorkspace({ lifecycle, paths, classes, onChanged, replayState, setReplayState }: Props) {
  const [plans, setPlans] = useState<BoProductPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [pathId, setPathId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [startsOn, setStartsOn] = useState(today());
  const [placementStartsOn, setPlacementStartsOn] = useState(today());
  const [itemDiscount, setItemDiscount] = useState("0");
  const [billDiscount, setBillDiscount] = useState("0");
  const [dueOn, setDueOn] = useState("");
  const [campaign, setCampaign] = useState("");
  const [latestSale, setLatestSale] = useState<BoSaleResult | null>(null);
  const [placements, setPlacements] = useState<string[]>([]);
  const [placementEntryTimes, setPlacementEntryTimes] = useState<string[]>([]);
  const [placementDurations, setPlacementDurations] = useState<string[]>([]);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const { pending, busy, notice, error } = replayState;
  const setPending = (pending: BillingReplayAttempt | null) => setReplayState((state) => ({ ...state, pending }));
  const setBusy = (busy: string | null) => setReplayState((state) => ({ ...state, busy }));
  const setNotice = (notice: string | null) => setReplayState((state) => ({ ...state, notice }));
  const setError = (error: string | null) => setReplayState((state) => ({ ...state, error }));
  const [billRevision, setBillRevision] = useState(0);

  async function loadPlans() {
    const next = await boApi.billingProductPlans();
    setPlans(next);
    setPlanId((current) => next.some((plan) => plan.id === current && plan.enabled)
      ? current
      : next.find((plan) => plan.enabled && plan.badge === "HERO")?.id ?? next.find((plan) => plan.enabled)?.id ?? "");
  }

  useEffect(() => { void loadPlans().catch((value) => setError(message(value))); }, []);
  useEffect(() => {
    setPathId((current) => paths.some((path) => path.id === current && path.status === "ACTIVE")
      ? current : paths.find((path) => path.status === "ACTIVE")?.id ?? "");
    setPayerId(lifecycle.guardians.find((item) => item.parent.status === "ACTIVE")?.parent.id ?? "");
  }, [lifecycle.student.id, lifecycle.guardians, paths]);

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;
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
    const count = selectedPlan?.cadence ?? 0;
    setPlacements(Array.from({ length: count }, () => ""));
    setPlacementEntryTimes(Array.from({ length: count }, () => ""));
    setPlacementDurations(Array.from({ length: count }, () => ""));
    if (!latestSale) setRegistrationComplete(false);
  }, [pathId]);
  const eligibleClasses = useMemo(() => classes.filter((item) => item.status === "ACTIVE" && item.pathProgramId === pathId), [classes, pathId]);
  const pendingRegistrationEntries = useMemo(() => lifecycle.subscriptions.filter((entry) => {
    const sub = entry.subscription;
    return sub.lifecycle === "ACTIVE"
      && entry.enrollments.length === 0
      && Boolean(sub.productPlanId && sub.contractualStartsOn && sub.contractualEndsOn)
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
    if (pending) { if (pending.key === key) await execute(pending); return; }
    const attempt = { key, idempotencyKey: crypto.randomUUID(), action, success };
    setPending(attempt); await execute(attempt);
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
    const body = bulkBody(sale);
    const preflight = await boApi.preflightBulkEnrollments(body);
    if (preflight.enrollments !== sale.productPlan.cadence) throw new Error("Bulk preflight không khớp cadence của Product Plan.");
    return boApi.placeBulkEnrollments({ ...body, policyEffectiveAt }, idempotencyKey);
  }

  async function resumePendingRegistration(entry: BoLearnerLifecycle["subscriptions"][number]) {
    if (busy || pending) return;
    const sub = entry.subscription;
    const billId = /^bill:([0-9a-f-]{36})$/.exec(sub.commercialReference ?? "")?.[1] ?? null;
    const plan = plans.find((item) => item.id === sub.productPlanId) ?? null;
    if (!billId || !plan || !sub.contractualStartsOn || !sub.contractualEndsOn || sub.weeklyCommitment !== plan.cadence) {
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
      setPlacementStartsOn(maxLocalDate(sub.contractualStartsOn, today()));
      setPlacements(Array.from({ length: plan.cadence }, () => ""));
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

  async function submitRegistration(event: React.FormEvent) {
    event.preventDefault();
    if (!planId || !pathId || !payerId || !selectedPlan) { setError("Chọn Product Plan, Path và Parent thanh toán."); return; }
    if (pendingRegistrationEntries.length) { setError("Student đã có Subscription Product Plan chưa placement. Hãy resume placement hiện hữu trước khi tạo sale mới."); return; }
    if (!placementsReady) { setError(`Chọn đủ ${selectedPlan.cadence} Running Classes khác nhau trước khi đăng ký.`); return; }
    if (latestSale && !registrationComplete) { setError("Subscription đã tạo; hãy hoàn tất placement, không tạo sale mới."); return; }
    const policyEffectiveAt = new Date().toISOString();
    await runReplay("registration", async (idempotencyKey) => {
      const sale = await boApi.createBillingSale({
        payerParentUserId: payerId, studentProfileId: lifecycle.student.id, pathProgramId: pathId,
        productPlanId: planId, contractualStartsOn: startsOn,
        itemDiscountMinor: money(itemDiscount), billDiscountMinor: money(billDiscount),
        ...(dueOn ? { dueOn } : {}), ...(campaign.trim() ? { campaignReference: campaign.trim() } : {}),
      }, idempotencyKey);
      setLatestSale(sale);
      await placeRegistration(sale, `${idempotencyKey}:placement`, policyEffectiveAt);
      setRegistrationComplete(true);
      return sale;
    }, `Đã tạo Subscription và xếp đủ ${selectedPlan.cadence}/${selectedPlan.cadence} Running Classes.`);
  }

  async function retryPlacement() {
    if (!latestSale || !selectedPlan || !placementsReady) { setError("Chọn lại đủ Running Classes trước khi retry placement."); return; }
    const policyEffectiveAt = new Date().toISOString();
    await runReplay(`placement:${latestSale.subscriptionId}`, async (idempotencyKey) => {
      const result = await placeRegistration(latestSale, idempotencyKey, policyEffectiveAt);
      setRegistrationComplete(true);
      return result;
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

    <section className={styles.createCard}>
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
    </section>

    {!latestSale && pendingRegistrationEntries.length ? <section className={styles.registrationPending}>
      <strong>Pending Running Class placement</strong>
      <p>Canonical Subscription đã tồn tại nhưng chưa có Enrollment. Resume placement hiện hữu; không tạo sale thứ hai.</p>
      {pendingRegistrationEntries.map((entry) => <button key={entry.subscription.id} type="button" disabled={Boolean(busy || pending)} onClick={() => void resumePendingRegistration(entry)}>
        {busy === `recover:${entry.subscription.id}` ? "Đang khôi phục…" : `Resume ${entry.subscription.pathDisplayName} · ${entry.subscription.weeklyCommitment} buổi/tuần`}
      </button>)}
    </section> : null}

    <form className={styles.createCard} onSubmit={(event) => void submitRegistration(event)}>
      <div className={styles.sectionHead}><div><span>New registration</span><h3>Tạo Subscription + Running Class placement</h3></div><small>Cadence từ Product Plan · chỉ complete sau bulk placement</small></div>
      <div className={styles.formGrid}>
        <label>Product Plan<select required disabled={Boolean(busy || pending || commercialLocked)} value={planId} onChange={(event) => setPlanId(event.target.value)}>
          <option value="">Chọn plan</option>{plans.filter((plan) => plan.enabled).map((plan) => <option key={plan.id} value={plan.id}>{plan.cadence}×/tuần · {plan.termWeeks} tuần · {formatVnd(plan.listPriceMinor)} {plan.badge === "HERO" ? "· HERO" : plan.badge === "ENTRY" ? "· ENTRY" : ""}</option>)}
        </select></label>
        <label>Path<select required disabled={Boolean(busy || pending || commercialLocked)} value={pathId} onChange={(event) => setPathId(event.target.value)}>
          <option value="">Chọn Path</option>{paths.filter((path) => path.status === "ACTIVE").map((path) => <option key={path.id} value={path.id}>{path.displayName}</option>)}
        </select></label>
        <label>Parent thanh toán<select required disabled={Boolean(busy || pending || commercialLocked)} value={payerId} onChange={(event) => setPayerId(event.target.value)}>
          <option value="">Chọn Parent</option>{lifecycle.guardians.filter((item) => item.parent.status === "ACTIVE").map((item) => <option key={item.parent.id} value={item.parent.id}>{item.parent.displayName ?? item.parent.contacts[0]?.value ?? item.parent.id}</option>)}
        </select></label>
        <label>Contract starts<input type="date" required disabled={Boolean(busy || pending || commercialLocked)} value={startsOn} onChange={(event) => { const value = event.target.value; setStartsOn(value); if (!commercialLocked) setPlacementStartsOn(maxLocalDate(value, today())); }} /></label>
        <label>Item discount (VND)<input type="number" min="0" disabled={Boolean(busy || pending || commercialLocked)} value={itemDiscount} onChange={(event) => setItemDiscount(event.target.value)} /></label>
        <label>Bill discount (VND)<input type="number" min="0" disabled={Boolean(busy || pending || commercialLocked)} value={billDiscount} onChange={(event) => setBillDiscount(event.target.value)} /></label>
        <label>Due date<input type="date" disabled={Boolean(busy || pending || commercialLocked)} value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
        <label>Campaign<input disabled={Boolean(busy || pending || commercialLocked)} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Tuỳ chọn" /></label>
      </div>
      {selectedPlan ? <>
        <p className={styles.hint}>Core plan: {selectedPlan.cadence} buổi/tuần · {selectedPlan.termWeeks} tuần · {selectedPlan.purchasedUnits} units. Contract end được Core tính; UI không gửi units/price/end date.</p>
        <div className={styles.placementWizard}>
          <div className={styles.sectionHead}><div><span>Recurring placement</span><h3>Chọn đúng {selectedPlan.cadence} Running Classes đã tạo sẵn</h3></div><small>{selectedPlacementCount}/{selectedPlan.cadence} assigned · capacity được Core preflight</small></div>
          <p className={styles.hint}>Mỗi Running Class = 1 weekly slot. Chỉ hiện lớp ACTIVE cùng Path; một lớp không thể chiếm hai slot của cùng Subscription.</p>
          <label className={styles.placementDate}>Placement starts<input type="date" min={today()} disabled={Boolean(busy || pending || registrationComplete)} value={placementStartsOn} onChange={(event) => setPlacementStartsOn(event.target.value)} /></label>
          <div className={styles.placementSlots}>{placements.map((value, index) => {
            const selectedClass = eligibleClasses.find((item) => item.id === value) ?? null;
            return <label className={styles.placementSlot} key={index}>
              <span>Recurring seat {index + 1}</span>
              <select disabled={Boolean(busy || pending || registrationComplete)} value={value} onChange={(event) => {
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
                <span>Entry time<input type="time" disabled={Boolean(busy || pending || registrationComplete)} value={placementEntryTimes[index] ?? ""} onChange={(event) => setPlacementEntryTimes((current) => current.map((item, position) => position === index ? event.target.value : item))} /></span>
                <span>Duration (min)<input type="number" min="1" disabled={Boolean(busy || pending || registrationComplete)} value={placementDurations[index] ?? ""} onChange={(event) => setPlacementDurations((current) => current.map((item, position) => position === index ? event.target.value : item))} /></span>
              </span> : null}
            </label>;
          })}</div>
          {!eligibleClasses.length ? <p className={styles.registrationPending}>Chưa có Running Class ACTIVE cùng Path. Tạo Running Class ở Delivery trước khi đăng ký.</p> : null}
        </div>
      </> : null}
      {latestSale && !registrationComplete ? <p className={styles.registrationPending}>Subscription {latestSale.subscriptionId.slice(0,8)}… đã tạo nhưng placement chưa hoàn tất. Có thể đổi Running Classes rồi retry placement; không tạo sale thứ hai.</p> : null}
      {registrationComplete && latestSale ? <p className={styles.registrationSuccess}>Registration complete · Enrollment {latestSale.productPlan.cadence}/{latestSale.productPlan.cadence} · Bill {latestSale.bill.bill.id.slice(0,8)}… · {latestSale.purchasedUnits} units.</p> : null}
      {latestSale && !registrationComplete
        ? <button className={styles.primary} disabled={Boolean(busy || pending || !placementsReady)} type="button" onClick={() => void retryPlacement()}>{busy?.startsWith("placement:") ? "Đang preflight/placement…" : `Hoàn tất placement ${selectedPlacementCount}/${selectedPlan?.cadence ?? 0}`}</button>
        : <button className={styles.primary} disabled={Boolean(busy || pending || !placementsReady || registrationComplete)} type="submit">{busy === "registration" ? "Đang tạo + preflight + placement…" : registrationComplete ? "Đăng ký hoàn tất" : `Confirm registration ${selectedPlacementCount}/${selectedPlan?.cadence ?? 0}`}</button>}
      {latestSale ? <p className={styles.saleResult}>Bill {latestSale.bill.bill.id.slice(0,8)}… · {latestSale.purchasedUnits} units · contract {latestSale.contractualStartsOn} → {latestSale.contractualEndsOn}</p> : null}
    </form>

    {billIds.length ? <section className={styles.section}>
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
