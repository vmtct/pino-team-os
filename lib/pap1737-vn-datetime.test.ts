// PAP-1737 · SCH-PARENTS-GUARDIANS: BO TDD datetime must display VN-local civil time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoValue } from "../app/bo/components/registration/BoValue";
import type { BoField } from "./bo-registration";

const render = (type: "datetime" | "date", value: string) =>
  renderToStaticMarkup(createElement(BoValue, {
    field: { key: "updatedAt", label: "Cập nhật", type, icon: "▦" } as BoField,
    value,
  }));

test("PAP-1737 datetime renders Core UTC instants in Asia/Ho_Chi_Minh", () => {
  assert.equal(render("datetime", "2026-11-09T03:13:58.926Z"), "09/11/2026 · 10:13");
  assert.equal(render("datetime", "2026-11-09T10:13:58+07:00"), "09/11/2026 · 10:13");
});

test("PAP-1737 UTC date rollover is reflected in Vietnam civil date and 24h clock", () => {
  assert.equal(render("datetime", "2026-11-09T17:30:00Z"), "10/11/2026 · 00:30");
  assert.equal(render("datetime", "2026-11-09T23:55:00Z"), "10/11/2026 · 06:55");
});

test("PAP-1737 date-only and invalid datetime retain safe existing display", () => {
  assert.equal(render("date", "2026-11-09"), "09/11/2026");
  assert.equal(render("datetime", "invalid-datetime"), "—");
});
