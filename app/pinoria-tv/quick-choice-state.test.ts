import assert from "node:assert/strict";
import test from "node:test";
import { beginQuickChoice, confirmQuickChoice, expireQuickChoice } from "./quick-choice-state";

const offers = [{ id: "owned", kind: "OWNED" as const, pricePls: null }, { id: "shop", kind: "SHOP" as const, pricePls: 80 }];
test("empty choice bypasses ritual without write", () => { assert.equal(beginQuickChoice("v", "s", [], 100).phase, "AMBIENT"); });
test("timeout cannot cause purchase or claim choice", () => {
 const state = beginQuickChoice("v", "s", offers, 100);
 assert.equal(state.deadlineMs, 8100);
 const expired = expireQuickChoice(state, 8100);
 assert.equal(expired.phase, "AMBIENT");
 assert.equal(expired.selectedCommandKey, null);
 assert.throws(() => confirmQuickChoice(expired, { visitId: "v", studentProfileId: "s", commandKey: "key", serverConfirmed: true }, 8100));
});
test("only server-confirmed matching learner and visit can advance", () => {
 const state = beginQuickChoice("v", "s", offers, 100);
 assert.throws(() => confirmQuickChoice(state, { visitId: "wrong", studentProfileId: "s", commandKey: "key", serverConfirmed: true }, 200));
 assert.throws(() => confirmQuickChoice(state, { visitId: "v", studentProfileId: "s", commandKey: "key", serverConfirmed: false }, 200));
 const confirmed = confirmQuickChoice(state, { visitId: "v", studentProfileId: "s", commandKey: "key", serverConfirmed: true }, 200);
 assert.equal(confirmed.phase, "AMBIENT");assert.equal(confirmed.selectedCommandKey, "key");
 assert.throws(() => confirmQuickChoice(confirmed, { visitId: "v", studentProfileId: "s", commandKey: "other", serverConfirmed: true }, 200));
});
test("reject forged prices, duplicates and excess choices", () => {
 assert.throws(() => beginQuickChoice("v", "s", [...offers, ...offers], 0));
 assert.throws(() => beginQuickChoice("v", "s", [{ id: "bad", kind: "SHOP", pricePls: null }], 0));
 assert.throws(() => beginQuickChoice("v", "s", Array.from({length: 7},(_,i)=>({id:String(i),kind:"OWNED" as const,pricePls:null})),0));
});
