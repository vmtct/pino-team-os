import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/bo/subscriptions/bo-subscriptions.module.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../app/bo/subscriptions/BoSubscriptionsView.tsx", import.meta.url), "utf8");

test("PAP-1223 keeps route error/status visible without exposing other detail-only chrome", () => {
  assert.ok(css.includes('.detailOnly > :not([id="detail-screen"]):not([data-bo-subscription-route-state]){display:none!important}'));
  assert.ok(source.includes('{detailRoute ? <div data-bo-subscription-route-state="true" className={styles.readHint} role={detailRoute.state==="error"?"alert":"status"}>'));
  assert.ok(source.includes('{historyDetail ? <BoFullDetail'));
});

test("PAP-1223 preserves invalid URL rejection and cannot mount a stale detail", () => {
  assert.match(source, /if\(route\.invalid\)\{setHistoryDetail\(null\);setDetailRoute\(\{state:"error"/);
  assert.ok(source.includes('Subscription ID trên URL không hợp lệ.'));
});