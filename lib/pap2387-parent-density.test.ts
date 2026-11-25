import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parentNativeFields, parentNativeModule } from "../app/bo/parents/parent-native-model";
import { pinoLocalizedLabel } from "./pino-nav-locale";

test("PAP-2387 compact Parent business fields keep audit columns default-visible", () => {
  assert.deepEqual(parentNativeFields.slice(0, 4).map(f => [f.key, f.w]), [
    ["name", 205], ["maskedContact", 160], ["studentCount", 110], ["centers", 140],
  ]);
  assert.deepEqual(parentNativeFields.slice(4, 8).map(f => [f.key, f.w, f.readonly, f.defaultVisible !== false]), [
    ["createdAt", 170, true, true], ["createdBy", 190, true, true],
    ["updatedAt", 170, true, true], ["updatedBy", 190, true, true],
  ]);
});
test("PAP-2387 uses established Parent locale mapping and preserves native action boundary", () => {
  assert.equal(pinoLocalizedLabel("bo", "Module Title", "parents", parentNativeModule.label, "vi"), "Phụ huynh");
  assert.equal(pinoLocalizedLabel("bo", "Module Title", "parents", parentNativeModule.label, "en"), "Parents & Guardians");
  const source = readFileSync("app/bo/parents/ParentDirectoryDsa.tsx", "utf8");
  assert.ok(source.includes("useContext(PinoNavLocaleContext)"));
  assert.ok(source.includes("<h1>{title}</h1>"));
  assert.ok(source.includes('grants.has("identity.parent.create")'));
  assert.ok(source.includes('onClick={()=>setCreating(true)}>{createLabel}'));
  assert.ok(source.includes('language==="vi"?"+ Phụ huynh":"+ Parent"'));
  const css = readFileSync("app/bo/parents/parent-directory-density.css", "utf8");
  assert.ok(css.includes("[data-parent-native-dsa] #typed-table .schema-column"));
});
