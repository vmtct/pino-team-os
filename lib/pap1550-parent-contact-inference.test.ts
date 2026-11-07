// PAP-1550 / Epic PAP-1384 — approved i5 Parent Create S2 parity and negative validation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferParentContactType } from "./bo-parent-create-client";

test("Parent Create infers PHONE or EMAIL from one approved contact field", () => {
  assert.equal(inferParentContactType("0912345678"), "PHONE");
  assert.equal(inferParentContactType("+84 912 345 678"), "PHONE");
  assert.equal(inferParentContactType("person@example.com"), "EMAIL");
  assert.equal(inferParentContactType("  person+tag@example.com  "), "EMAIL");
  for (const bad of ["", "12345678", "09123abcd", "not-an-email", "a@b", "bad@@example.com", "user@exam ple.com"]) {
    assert.equal(inferParentContactType(bad), null, bad);
  }
});

test("S2 Drawer consumes PINO DS and matches approved i5 2-field manifest", () => {
  const source = readFileSync(new URL("../app/bo/parents/ParentCreateDrawer.tsx", import.meta.url), "utf8");
  assert.match(source, /<DrawerFrame title="Tạo phụ huynh" path="School · Parents & Guardians"/);
  assert.match(source, /<label[^>]*>Họ và tên \*<\/label>/);
  assert.match(source, /<label[^>]*>Điện thoại hoặc email \*<\/label>/);
  assert.match(source, /identifierType: inferredType!/);
  assert.match(source, /inferParentContactType\(contactValue\)/);
  assert.match(source, /BoActionButton variant="primary"/);
  assert.match(source, /attemptRef\.current/);
  assert.doesNotMatch(source, /parent-create-type|Loại liên hệ|setContactType/);
  assert.doesNotMatch(source, /<select|type=\{contactType/);
});