import test from "node:test";
import assert from "node:assert/strict";
import { shortDisplayName } from "./display-name";

test("shortDisplayName uses the right-most word and sentence-cases only that word", () => {
  assert.equal(shortDisplayName("Văn Minh Trị"), "Trị");
  assert.equal(shortDisplayName("  Chu   Thúy   Hằng  "), "Hằng");
  assert.equal(shortDisplayName("ĐẶNG TRẦN HOÀNG TRANG"), "Trang");
  assert.equal(shortDisplayName("pino STAFF"), "Staff");
});

test("shortDisplayName never invents a name for a missing label", () => {
  assert.equal(shortDisplayName(""), "");
  assert.equal(shortDisplayName(null), "");
  assert.equal(shortDisplayName(undefined), "");
});
