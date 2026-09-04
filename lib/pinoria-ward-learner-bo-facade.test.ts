import test from "node:test";
import assert from "node:assert/strict";
import {isOperationalReadPath} from "./bo-read-handler";
import {isAllowedPostPath} from "./bo-write-handler";

const id="00000000-0000-7000-8000-000000000001";
test("WARD F2 BO facade exposes only canonical learner wardrobe paths",()=>{
  assert.equal(isOperationalReadPath("pinoria/ward/learners"),true);
  assert.equal(isOperationalReadPath(`pinoria/ward/learners/${id}`),true);
  assert.equal(isAllowedPostPath(`pinoria/ward/learners/${id}/grants`),true);
  assert.equal(isAllowedPostPath(`pinoria/ward/learners/${id}/revocations`),true);
  assert.equal(isAllowedPostPath(`pinoria/ward/learners/${id}/loadout`),true);
  assert.equal(isAllowedPostPath("pinoria/ward/learners/anything"),false);
  assert.equal(isOperationalReadPath("pinoria/wish/learners"),false);
});
