import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { VIETNAM_REGISTRATION_BANKS as banks } from "./vietnam-registration-banks";

test("PAP-2048 has stable unique bank BINs and canonical values, not wallets", () => {
  assert.equal(banks.length, 54);
  assert.equal(new Set(banks.map(bank => bank.bin)).size, banks.length);
  assert.equal(new Set(banks.map(bank => bank.name.toLowerCase())).size, banks.length);
  assert.ok(banks.every(bank => /^\d{6}$/.test(bank.bin) && bank.name.length <= 120));
  assert.ok(banks.some(bank => bank.name === "Vietcombank"));
  assert.ok(banks.some(bank => bank.name === "VCBNeo" && bank.label.includes("CBBank")));
  assert.ok(!banks.some(bank => /momo|zalopay|viettelmoney|vnptmoney/i.test(bank.name)));
});

test("PAP-2048 form requires an unselected native bank picker and submits canonical bankName", () => {
  const page = fs.readFileSync("app/staff/register/page.tsx", "utf8");
  assert.match(page, /<select name="bankName"[^>]*required[^>]*>/);
  assert.match(page, /<option value="">Chọn ngân hàng<\/option>/);
  assert.match(page, /key=\{bank\.bin\} value=\{bank\.name\}/);
  assert.doesNotMatch(page, /<input name="bankName"/);
});
