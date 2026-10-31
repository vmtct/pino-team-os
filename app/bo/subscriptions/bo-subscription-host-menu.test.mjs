import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = () => readFileSync(new URL("./BoSubscriptionsView.tsx", import.meta.url), "utf8");
const workspace = () => readFileSync(new URL("../components/registration/BoRegistrationWorkspace.tsx", import.meta.url), "utf8");

test("PAP-1081 uses one canonical BO host menu for Subscription list and Full Detail", () => {
  const source = view();
  assert.match(workspace(), /TddHostMenu\.Provider value=\{menu\}/);
  assert.match(source, /useContext\(TddHostMenu\)/);
  assert.match(source, /hostMenu\("subscription-menu-btn"\)/);
  assert.match(source, /hostMenu\("subscription-detail-menu-btn"\)/);
  assert.match(source, /<header className="page-heading">/);
  assert.doesNotMatch(source, /mobileMenu=\{null\}|styles\.readHeading/);
});

test("PAP-1081 preserves one canonical Create Drawer and no standalone sidebar clone", () => {
  const source = view();
  assert.match(source, /<SubscriptionCreateDrawer/);
  assert.doesNotMatch(source, /<aside[^>]*className="sidebar"/);
  assert.doesNotMatch(source, /new BroadcastChannel/);
});
