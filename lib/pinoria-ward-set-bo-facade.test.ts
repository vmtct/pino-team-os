import test from "node:test";
import assert from "node:assert/strict";
import {isOperationalReadPath} from "./bo-read-handler";
import {isAllowedPostPath} from "./bo-write-handler";

test("WARD F1 BO facade exposes canonical Set and WEBM paths",()=>{
  assert.equal(isOperationalReadPath("pinoria/ward/sets"),true);
  assert.equal(isOperationalReadPath("pinoria/ward/set-webm-assets"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/sets"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/sets/00000000-0000-7000-8000-000000000001"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/sets/00000000-0000-7000-8000-000000000001/members"),true);
  assert.equal(isAllowedPostPath("pinoria/ward/set-webm-assets"),true);
  assert.equal(isAllowedPostPath("pinoria/wish/catalog/sets"),false);
});
