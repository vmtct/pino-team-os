import test from "node:test";
import assert from "node:assert/strict";
import { isOperationalReadPath } from "./bo-read-handler";
import { isAllowedPostPath } from "./bo-write-handler";

const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";

test("F1-BO Web CMS facade allows only bounded registry/detail/history reads", () => {
  for (const path of ["web-cms/slots", `web-cms/slots/${id}`, `web-cms/slots/${id}/history`]) assert.equal(isOperationalReadPath(path), true, path);
  for (const path of ["web-cms", "web-cms/sites", `web-cms/slots/${id}/audit`, "web-cms/slots/not-a-canonical-id"]) assert.equal(isOperationalReadPath(path), false, path);
});

test("F1-BO Web CMS facade allows only draft, publish, and rollback writes with no manifest sync", () => {
  for (const action of ["draft", "publish", "rollback"]) assert.equal(isAllowedPostPath(`web-cms/slots/${id}/${action}`), true, action);
  for (const path of ["web-cms/manifests/sync", "web-cms/manifest-sync", "web-cms/slots", `web-cms/slots/${id}/retire`, `web-cms/slots/${id}/draft/extra`]) assert.equal(isAllowedPostPath(path), false, path);
});
