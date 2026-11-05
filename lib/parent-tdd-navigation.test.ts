import test from "node:test";
import assert from "node:assert/strict";
import { parentCenterUrl, restoreParentCenter } from "../app/bo/parents/navigation";

const first = { id: "0199f001-0000-7000-8000-000000000001", displayName: "Authorized A" };
const second = { id: "0199f001-0000-7000-8000-000000000002", displayName: "Authorized B" };
const url = new URL("https://bo.staging.pinohouse.art/bo?module=parents&pilot=tdd&record=019d2000-0002-7000-8000-000000000001#detail");

test("PAP-1184 Parent record reload restores its selected authorized Center", () => {
  const remembered = new URL(parentCenterUrl(url, second.id), url.origin);
  assert.equal(restoreParentCenter([first, second], remembered), second.id);
  assert.equal(remembered.searchParams.get("record"), url.searchParams.get("record"));
  assert.equal(remembered.searchParams.get("module"), "parents");
  assert.equal(remembered.searchParams.get("pilot"), "tdd");
  assert.equal(remembered.hash, "#detail");
  assert.equal(url.searchParams.has("centerId"), false, "caller URL is unchanged");
});

test("PAP-1184 URL context never grants a missing or revoked Center", () => {
  const remembered = new URL(parentCenterUrl(url, second.id), url.origin);
  assert.equal(restoreParentCenter([first], remembered), "");
  assert.equal(restoreParentCenter([], remembered), "");
  remembered.searchParams.set("centerId", "not-a-center");
  assert.equal(restoreParentCenter([first, second], remembered), "");
});

test("PAP-1184 unselected Parent entry keeps existing single-Center behavior", () => {
  assert.equal(restoreParentCenter([first], url), first.id);
  assert.equal(restoreParentCenter([first, second], url), "");
  assert.equal(restoreParentCenter([], url), "");
  const cleared = new URL(parentCenterUrl(new URL(parentCenterUrl(url, first.id), url.origin), ""), url.origin);
  assert.equal(cleared.searchParams.has("centerId"), false);
  assert.equal(cleared.searchParams.get("record"), url.searchParams.get("record"));
});
