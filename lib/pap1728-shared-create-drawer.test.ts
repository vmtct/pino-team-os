// PAP-1728 / PAP-1724 · SCH-PARENTS-GUARDIANS: Founder G3 renderer contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { parentDefinition, parentSchema } from "../app/bo/parents/schema";
import { toLegacyModule } from "./workspace-schema";
import type { BoRecord } from "./bo-registration";

const fields = toLegacyModule(parentSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields;
const sections = parentDefinition.drawer.sections;
const draft: BoRecord = {
  id: "", name: "", maskedContact: null, studentCount: 0,
  centers: "PINO Cần Thơ", updatedAt: null, attention: null,
};

test("PAP-1728 Create and View use the identical typed Drawer property renderer", () => {
  const view = renderToStaticMarkup(createElement(PropertySections, { variant: "drawer", fields, sections, record: draft }));
  const create = renderToStaticMarkup(createElement(PropertySections, {
    variant: "drawer", fields, sections, record: draft,
    createFields: {
      name: { id: "parent-create-name", label: "Họ và tên *", value: "", onChange: () => {}, required: true },
      maskedContact: { id: "parent-create-contact", label: "Điện thoại hoặc email *", value: "", onChange: () => {}, required: true },
    },
  }));
  const count = (html: string, fragment: RegExp) => Array.from(html.matchAll(fragment)).length;
  assert.equal(count(view, /class="property-row"/g), fields.length);
  assert.equal(count(create, /class="property-row"/g), fields.length);
  assert.equal(count(create, /<input\b/g), 2, "only two approved inputs");
  assert.equal(count(create, /<button\b/g), fields.length - 2, "other properties stay read-only");
  assert.match(create, /data-tdd-create=""/);
  assert.doesNotMatch(view, /data-tdd-create=/);
  assert.match(create, /data-prop="studentCount"/);
  assert.match(create, /<label[^>]+for="parent-create-name"/);
  assert.match(create, /<label[^>]+for="parent-create-contact"/);
  assert.match(create, /value=""/);
  assert.match(create, /Số học viên/);
  assert.match(create, />0</);
});

test("PAP-1724 Parent Create consumes actual shared renderer, no handmade rows or CSS clone", () => {
  const drawer = readFileSync(new URL("../app/bo/parents/ParentCreateDrawer.tsx", import.meta.url), "utf8");
  assert.match(drawer, /<PropertySections variant="drawer"/);
  assert.match(drawer, /fields=\{drawerFields\}/);
  assert.match(drawer, /sections=\{parentDefinition\.drawer\.sections\}/);
  assert.match(drawer, /toLegacyModule\(parentSchema/);
  assert.match(drawer, /studentCount: 0/);
  assert.doesNotMatch(drawer, /<section className="property-section"/);
  assert.doesNotMatch(drawer, /<label className="property-row"/);
  assert.doesNotMatch(drawer, /className="os-create-select"/);
});
