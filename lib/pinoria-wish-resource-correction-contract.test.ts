import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {resolve} from "node:path";

const root=resolve(process.cwd());
const panel=readFileSync(resolve(root,"app/bo/pinoria-wish/EnergySeedCorrectionPanel.tsx"),"utf8");
const view=readFileSync(resolve(root,"app/bo/pinoria-wish/WishBoView.tsx"),"utf8");
const facade=readFileSync(resolve(root,"lib/founder-facade-handler.ts"),"utf8");

test("JCS06 Founder BO exposes discoverable audited Energy Seed correction",()=>{
  assert.match(view,/EnergySeedCorrectionPanel/);
  assert.match(panel,/data-jcs06-resource-correction/);
  assert.match(panel,/pinoria\/wish\/resources\/energy-seeds\/learners/);
  assert.match(panel,/Founder-only, append-only correction/);
  assert.match(panel,/Attendance history sẽ được giữ nguyên/);
  assert.match(panel,/original earn không bị rewrite/);
});

test("JCS06 correction UI sends exact earn authority with replay key through Founder facade",()=>{
  assert.match(panel,/earnLedgerId:event\.id/);
  assert.match(panel,/idempotency-key/);
  assert.match(panel,/jcs06-energy-seed:\$\{event\.id\}/);
  assert.match(panel,/correctionReason:reason\.trim\(\)/);
  assert.match(facade,/idempotencyKey: request\.headers\.get\("idempotency-key"\)/);
  assert.doesNotMatch(panel,/D1|database|DELETE FROM|UPDATE pinoria_resource_wallets/);
});
