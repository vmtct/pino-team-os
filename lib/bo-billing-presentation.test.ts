import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isOperationalReadPath } from "./bo-read-handler";
import { isAllowedPostPath } from "./bo-write-handler";

const id = "01999999-9999-7999-8999-999999999999";
const read = (path: string) => readFile(path, "utf8");

test("Billing BO facade exposes only canonical Core billing paths", () => {
  assert.equal(isOperationalReadPath("billing/product-plans"), true);
  assert.equal(isOperationalReadPath(`billing/bills/${id}`), true);
  assert.equal(isOperationalReadPath("billing/bills/not-a-canonical-id"), false);
  for (const path of [
    `billing/product-plans/${id}/configure`,
    "billing/sales",
    `billing/bills/${id}/transactions`,
    `billing/bills/${id}/void`,
    `billing/transactions/${id}/void`,
    "enrollments/bulk-preflight",
    "enrollments/bulk-place",
  ]) assert.equal(isAllowedPostPath(path), true, path);
  assert.equal(isAllowedPostPath("billing/product-plans"), false);
  assert.equal(isAllowedPostPath(`billing/product-plans/${id}`), false);
  assert.equal(isAllowedPostPath(`billing/bills/${id}/delete`), false);
});

test("Subscriptions mounts Product Plan, sale, Bill and Payment presentation", async () => {
  const [view, billing, api, model, writeHandler] = await Promise.all([
    read("app/bo/subscriptions/BoSubscriptionsView.tsx"),
    read("app/bo/subscriptions/BillingWorkspace.tsx"),
    read("lib/bo-api.ts"),
    read("lib/bo-model.ts"),
    read("lib/bo-write-handler.ts"),
  ]);
  assert.match(view, /import \{ BillingWorkspace, type BillingReplayState \}/);
  assert.match(view, /<BillingWorkspace lifecycle=\{data\} paths=\{props\.catalog\.paths\} classes=\{props\.catalog\.classes\} onChanged=\{props\.onChanged\}/);
  assert.match(view, /replayState=\{props\.billingReplay\} setReplayState=\{props\.setBillingReplay\}/);
  assert.match(billing, /const TERMS = \[12, 24, 48\] as const/);
  assert.match(billing, /const CADENCES = \[1, 2, 3, 4, 5, 6\] as const/);
  assert.match(billing, /boApi\.updateBillingProductPlan/);
  assert.match(billing, /boApi\.createBillingSale/);
  assert.match(billing, /boApi\.billingBill/);
  assert.match(billing, /boApi\.recordBillingTransaction/);
  assert.match(billing, /"PAYMENT"/);
  assert.match(billing, /"REFUND"/);
  assert.match(api, /billingProductPlans:/);
  assert.match(api, /billing\/product-plans\/\$\{encodeURIComponent\(productPlanId\)\}\/configure/);
  assert.match(api, /createBillingSale:/);
  assert.match(api, /recordBillingTransaction:/);
  assert.match(api, /preflightBulkEnrollments:/);
  assert.match(api, /placeBulkEnrollments:/);
  assert.match(model, /contractualStartsOn: string \| null/);
  assert.match(model, /export interface BoBillSummary/);
  assert.match(view, /Contract starts <b>\{sub\.contractualStartsOn \?\? "—"\}<\/b>/);
  assert.match(writeHandler, /BILLING_SALE_PATH \|\| BILLING_TRANSACTION_PATH\.test\(path\)/);

  const start = billing.indexOf("boApi.createBillingSale({");
  const end = billing.indexOf("}, idempotencyKey)", start);
  assert.ok(start >= 0 && end > start);
  const saleCall = billing.slice(start, end);
  for (const field of ["payerParentUserId", "studentProfileId", "pathProgramId", "productPlanId", "contractualStartsOn"]) {
    assert.match(saleCall, new RegExp(field));
  }
  assert.doesNotMatch(saleCall, /listPriceMinor|purchasedUnits|termWeeks|cadence|contractualEndsOn/);
});

test("Billing presentation keeps financial truth in Core and retries exact sale/payment commands", async () => {
  const billing = await read("app/bo/subscriptions/BillingWorkspace.tsx");
  assert.match(billing, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(billing, /attempt\.action\(attempt\.idempotencyKey\)/);
  assert.match(billing, /Retry exact command/);
  assert.match(billing, /Core plan:/);
  assert.match(billing, /Contract end được Core tính; UI không gửi units\/price\/end date/);
  assert.match(billing, /summary\.paymentState/);
  assert.doesNotMatch(billing, /paymentState\s*=(?!=)|balanceMinor\s*=(?!=)|netAmountMinor\s*=(?!=)/);
});


test("Billing replay authority survives lifecycle remount and freezes payment fingerprints", async () => {
  const [view, billing, host] = await Promise.all([
    read("app/bo/subscriptions/BoSubscriptionsView.tsx"),
    read("app/bo/subscriptions/BillingWorkspace.tsx"),
    read("lib/host-boundary.ts"),
  ]);
  assert.match(view, /const \[billingReplay, setBillingReplay\] = useState<BillingReplayState>/);
  assert.match(view, /pendingAttempt \|\| billingReplay\.pending \|\| billingReplay\.busy/);
  assert.match(view, /blocked=\{Boolean\(commandState\.busy \|\| pendingAttempt \|\| billingReplay\.busy \|\| billingReplay\.pending\)\}/);
  assert.match(billing, /const transactionBody = \{/);
  assert.match(billing, /occurredAt: new Date\(\)\.toISOString\(\)/);
  assert.match(billing, /recordBillingTransaction\(billId, transactionBody, idempotencyKey\)/);
  assert.doesNotMatch(billing, /recordBillingTransaction\(billId, \{[\s\S]{0,180}occurredAt: new Date/);
  assert.match(host, /api\\\/bo\\\/billing\\\/product-plans/);
  assert.match(host, /api\\\/bo\\\/billing\\\/bills/);
});

test("Product Plan cadence drives exact distinct Running Class placements before registration completion", async () => {
  const billing = await read("app/bo/subscriptions/BillingWorkspace.tsx");
  assert.match(billing, /Array\.from\(\{ length: count \}/);
  assert.match(billing, /selectedPlacementCount === selectedPlan!\.cadence/);
  assert.match(billing, /new Set\(placementIds\)\.size === placementIds\.length/);
  assert.match(billing, /item\.status === "ACTIVE" && item\.pathProgramId === pathId/);
  assert.match(billing, /usedElsewhere = placements\.some/);
  assert.match(billing, /expectedWeeklyCommitment: sale\.productPlan\.cadence/);
  assert.match(billing, /boApi\.preflightBulkEnrollments\(body\)/);
  assert.match(billing, /boApi\.placeBulkEnrollments/);
  assert.match(billing, /`\$\{idempotencyKey\}:placement`/);
  assert.match(billing, /Subscription đã tạo; hãy hoàn tất placement, không tạo sale mới/);
  assert.match(billing, /latestSale && !registrationComplete/);
  assert.doesNotMatch(billing, /expectedWeeklyCommitment:\s*Number\(/);
});

test("New registration passes only canonical sale inputs and keeps manual cadence in repair path", async () => {
  const [billing, view] = await Promise.all([
    read("app/bo/subscriptions/BillingWorkspace.tsx"),
    read("app/bo/subscriptions/BoSubscriptionsView.tsx"),
  ]);
  const start = billing.indexOf("const sale = await boApi.createBillingSale({");
  const end = billing.indexOf("}, idempotencyKey);", start);
  assert.ok(start >= 0 && end > start);
  const call = billing.slice(start, end);
  assert.doesNotMatch(call, /weeklyCommitment|purchasedUnits|contractualEndsOn|listPriceMinor/);
  assert.match(view, /Manual repair only/);
  assert.match(view, /New registrations phải dùng Product Plan \+ exact cadence placement phía trên/);
});
