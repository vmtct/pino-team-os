import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPositiveListRead } from "./bo-payroll-staging.mjs";

const good = {status:[200], shell:true, alert:0, rows:1, empty:false};
test("positive native row and genuine empty list pass", () => {
  assert.doesNotThrow(() => assertPositiveListRead(good));
  assert.doesNotThrow(() => assertPositiveListRead({...good, rows:0, empty:true}));
});
test("missing, unknown or denied HTTP cannot pass even if DOM looks empty", () => {
  for (const status of [[], [0], [undefined], [403], [500], [200,403]]) {
    assert.throws(() => assertPositiveListRead({...good, status, rows:0, empty:true}), /HTTP_NOT_PROVED/);
  }
});
test("visible list shell alone or alert never proves read", () => {
  for (const patch of [{shell:false},{alert:1},{rows:0,empty:false}]) {
    assert.throws(() => assertPositiveListRead({...good,...patch}), /DOM_NOT_PROVED/);
  }
});
