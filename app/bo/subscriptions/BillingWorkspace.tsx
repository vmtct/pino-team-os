"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoBillSummary, BoLearnerLifecycle, BoPathProgram, BoPaymentMethod, BoPaymentTransactionKind, BoProductPlan, BoSaleResult } from "@/lib/bo-model";
import styles from "./bo-subscriptions.module.css";

type Props = { lifecycle: BoLearnerLifecycle; paths: BoPathProgram[]; onChanged: () => Promise<void> };
type ReplayAttempt = { key: string; idempotencyKey: string; action: (key: string) => Promise<unknown>; success: string };
const TERMS = [12, 24, 48] as const;
const CADENCES = [1, 2, 3, 4, 5, 6] as const;

export function BillingWorkspace({ lifecycle, paths, onChanged }: Props) {
  const [plans, setPlans] = useState<BoProductPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [pathId, setPathId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [startsOn, setStartsOn] = useState(today());
  const [itemDiscount, setItemDiscount] = useState("0");
  const [billDiscount, setBillDiscount] = useState("0");
  const [dueOn, setDueOn] = useState("");
  const [campaign, setCampaign] = useState("");
  const [latestSale, setLatestSale] = useState<BoSaleResult | null>(null);
  const [pending, setPending] = useState<ReplayAttempt | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const billIds = useMemo(() => [...new Set(lifecycle.subscriptions
    .map((entry) => /^bill:([0-9a-f-]{36})$/.exec(entry.subscription.commercialReference ?? "")?.[1] ?? null)
    .filter((value): value is string => Boolean(value)))], [lifecycle.subscriptions]);

  async function execute(attempt: ReplayAttempt) {
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

  async function submitSale(event: React.FormEvent) {
    event.preventDefault();
    if (!planId || !pathId || !payerId) { setError("Chọn Product Plan, Path và Parent thanh toán."); return; }
    await runReplay("sale", (idempotencyKey) => boApi.createBillingSale({
      payerParentUserId: payerId, studentProfileId: lifecycle.student.id, pathProgramId: pathId,
      productPlanId: planId, contractualStartsOn: startsOn,
      itemDiscountMinor: money(itemDiscount), billDiscountMinor: money(billDiscount),
      ...(dueOn ? { dueOn } : {}), ...(campaign.trim() ? { campaignReference: campaign.trim() } : {}),
    }, idempotencyKey).then((sale) => { setLatestSale(sale); return sale; }), "Đã tạo Bill + Subscription + entitlement atomically.");
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
    await runReplay(`${kind}:${billId}`, (idempotencyKey) => boApi.recordBillingTransaction(billId, {
      transactionKind: kind, amountMinor: money(raw), occurredAt: new Date().toISOString(), method: methodRaw,
    }, idempotencyKey), kind === "PAYMENT" ? "Đã ghi nhận thanh toán." : "Đã ghi nhận hoàn tiền.");
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

    <form className={styles.createCard} onSubmit={(event) => void submitSale(event)}>
      <div className={styles.sectionHead}><div><span>New sale</span><h3>Tạo Bill + Subscription</h3></div><small>Core snapshots plan economics and derives contractual end</small></div>
      <div className={styles.formGrid}>
        <label>Product Plan<select required disabled={Boolean(busy || pending)} value={planId} onChange={(event) => setPlanId(event.target.value)}>
          <option value="">Chọn plan</option>{plans.filter((plan) => plan.enabled).map((plan) => <option key={plan.id} value={plan.id}>{plan.cadence}×/tuần · {plan.termWeeks} tuần · {formatVnd(plan.listPriceMinor)} {plan.badge === "HERO" ? "· HERO" : plan.badge === "ENTRY" ? "· ENTRY" : ""}</option>)}
        </select></label>
        <label>Path<select required disabled={Boolean(busy || pending)} value={pathId} onChange={(event) => setPathId(event.target.value)}>
          <option value="">Chọn Path</option>{paths.filter((path) => path.status === "ACTIVE").map((path) => <option key={path.id} value={path.id}>{path.displayName}</option>)}
        </select></label>
        <label>Parent thanh toán<select required disabled={Boolean(busy || pending)} value={payerId} onChange={(event) => setPayerId(event.target.value)}>
          <option value="">Chọn Parent</option>{lifecycle.guardians.filter((item) => item.parent.status === "ACTIVE").map((item) => <option key={item.parent.id} value={item.parent.id}>{item.parent.displayName ?? item.parent.contacts[0]?.value ?? item.parent.id}</option>)}
        </select></label>
        <label>Contract starts<input type="date" required disabled={Boolean(busy || pending)} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
        <label>Item discount (VND)<input type="number" min="0" disabled={Boolean(busy || pending)} value={itemDiscount} onChange={(event) => setItemDiscount(event.target.value)} /></label>
        <label>Bill discount (VND)<input type="number" min="0" disabled={Boolean(busy || pending)} value={billDiscount} onChange={(event) => setBillDiscount(event.target.value)} /></label>
        <label>Due date<input type="date" disabled={Boolean(busy || pending)} value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
        <label>Campaign<input disabled={Boolean(busy || pending)} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Tuỳ chọn" /></label>
      </div>
      {selectedPlan ? <p className={styles.hint}>Core plan: {selectedPlan.cadence} buổi/tuần · {selectedPlan.termWeeks} tuần · {selectedPlan.purchasedUnits} units. Contract end được Core tính; UI không gửi units/price/end date.</p> : null}
      <button className={styles.primary} disabled={Boolean(busy || pending)} type="submit">{busy === "sale" ? "Đang tạo…" : "Tạo sale"}</button>
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
function today() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
function message(value: unknown) { return value instanceof Error ? value.message : "Billing operation failed."; }
