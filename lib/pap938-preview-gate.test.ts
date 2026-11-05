import test from "node:test";
import assert from "node:assert/strict";
import {allowPap938LocalPreview} from "../app/prototype/tos-vnext-integration/preview-gate";

test("PAP-938 local preview must be explicitly enabled in development",()=>{
 assert.equal(allowPap938LocalPreview({NODE_ENV:"development",PAP938_VNEXT_LOCAL_PREVIEW:"true"}),true);
 for(const env of [
  {NODE_ENV:"development"},
  {NODE_ENV:"development",PAP938_VNEXT_LOCAL_PREVIEW:"TRUE"},
  {NODE_ENV:"development",PAP938_VNEXT_LOCAL_PREVIEW:"1"},
  {NODE_ENV:"production",PAP938_VNEXT_LOCAL_PREVIEW:"true"},
  {NODE_ENV:"test",PAP938_VNEXT_LOCAL_PREVIEW:"true"},
  {PAP938_VNEXT_LOCAL_PREVIEW:"true"}
 ]) assert.equal(allowPap938LocalPreview(env),false,JSON.stringify(env));
});
