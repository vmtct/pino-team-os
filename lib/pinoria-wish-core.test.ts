import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const operationalReveal = source("../app/api/pinoria-prototype/wish-reveal/route.ts");
const demoReveal = source("../app/api/pinoria-prototype/wish-reveal-demo/route.ts");
const wishControl = source("../app/api/pinoria-prototype/wish-control/route.ts");
const wishController = source("../app/pinoria-controller/pinoria-wish-controller.tsx");
const remote = source("../app/pinoria-tv/prototype-remote-controls.tsx");
const tv = source("../app/pinoria-tv/tv-prototype.tsx");
const wrangler = JSON.parse(source("../wrangler.jsonc")) as {
  vars: Record<string, string>;
  services: Array<{ binding: string; service: string; entrypoint: string }>;
};

test("Pinoria Wish uses distinct private Core service bindings", () => {
  const bindings = Object.fromEntries(wrangler.services.map((item) => [item.binding, item]));
  assert.equal(bindings.PINO_TOS_CORE?.entrypoint, "TosLearningControlPlane");
  assert.equal(bindings.PINO_STAFF_PIN_CORE?.entrypoint, "StaffPinControlPlane");
  assert.equal(bindings.PINO_TV_CORE?.entrypoint, "PinoriaTvControlPlane");
  assert.equal(wrangler.vars.PINORIA_CENTER_ID, "01a02354-6be1-7c77-a2dd-513052a18b98");
});

test("operational TV reveal is Core-only while Founder review is fixture-only", () => {
  assert.match(operationalReveal, /PINO_TV_CORE\.claimWishReveal/);
  assert.match(operationalReveal, /PINO_TV_CORE\.completeWishReveal/);
  assert.doesNotMatch(operationalReveal, /enqueue-demo|reset-demo|demoReveal/);
  assert.match(demoReveal, /enqueue-demo/);
  assert.match(demoReveal, /reset-demo/);
  assert.match(remote, /PINORIA_WISH_REVEAL_DEMO_URL/);
  assert.doesNotMatch(remote, /fetch\(PINORIA_WISH_REVEAL_URL/);
  assert.match(tv, /reviewEnabled \? PINORIA_WISH_REVEAL_DEMO_URL : PINORIA_WISH_REVEAL_URL/);
  assert.match(tv, /\}, \[wishRevealEndpoint\]\);/);
});

test("staff Wish control keeps Core PIN session server-side and Center server-owned", () => {
  assert.match(wishControl, /httpOnly: true/);
  assert.match(wishControl, /sameSite: "strict"/);
  assert.match(wishControl, /PINO_STAFF_PIN_CORE\.login/);
  assert.match(wishControl, /PINO_TOS_CORE\.executeWithStaffPin/);
  assert.match(wishControl, /PINO_TV_CORE\.snapshot/);
  assert.match(wishControl, /configuredCenter\(core\)/);
  assert.doesNotMatch(wishControl, /localStorage|sessionStorage/);
  assert.doesNotMatch(wishController, /PINORIA_WISH_REVEAL_DEMO_URL|enqueue-demo/);
  assert.match(wishController, /pendingDrawRef/);
  assert.match(wishController, /sameAttempt \? pending\.key : crypto\.randomUUID\(\)/);
});