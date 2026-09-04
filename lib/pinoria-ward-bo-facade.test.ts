import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalReadPath } from "./bo-read-handler";
import { isAllowedPostPath } from "./bo-write-handler";

test("WARD F0 BO facade exposes only canonical catalog paths",()=>{
  assert.equal(isOperationalReadPath("pinoria/ward/catalog"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/catalog/items"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/catalog/items/01999999-9999-7999-8999-999999999999"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/catalog/variants"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/catalog/variants/01999999-9999-7999-8999-999999999999"),true);
  assert.equal(isOperationalReadPath("pinoria/wish/catalog/wearables"),false);
});
