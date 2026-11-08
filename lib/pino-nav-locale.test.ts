/* PAP-1604/1605/1606 · Epic PAP-1601 · exact VI/EN S1 contract tests. */
import test from "node:test";
import assert from "node:assert/strict";
import { pinoLocaleRows, pinoBuildHoLocaleRows, pinoLocalizedLabel, pinoLocaleSearchMatches, pinoLocaleStorageKey } from "./pino-nav-locale";
import { hoModules } from "./ho-system";
import { HO_PAGE_PATHS } from "./ho-routes";

test("Founder-approved vocabulary is exact, including singular Running Class", () => {
  const cases = [
    ["classes", "Running Classes", "Running Class", "Ca học"],
    ["workforce-shift-plans", "Center Shift Plans", "Center Shift Plans", "Kế Hoạch Tuần"],
    ["workforce-availability", "Staff Availability", "Staff Availability", "Lịch đăng ký"],
    ["subscriptions", "Subscriptions", "Subscriptions", "Gói học"],
    ["classroom-diaries", "Nhật ký lớp học", "Classroom Diaries", "Nhật Ký"],
  ] as const;
  for (const [key, sourceLabel, en, vi] of cases) {
    assert.equal(pinoLocalizedLabel("bo", "Nav Item", key, sourceLabel, "en"), en, key);
    assert.equal(pinoLocalizedLabel("bo", "Nav Item", key, sourceLabel, "vi"), vi, key);
    assert.equal(pinoLocalizedLabel("bo", "Module Title", key, sourceLabel, "en"), en, key);
    assert.equal(pinoLocalizedLabel("bo", "Module Title", key, sourceLabel, "vi"), vi, key);
  }
  assert.equal(pinoLocalizedLabel("ho", "Nav Item", "classroomDiaries", "Nhật ký lớp học", "vi"), "Nhật Ký");
  assert.equal(pinoLocalizedLabel("ho", "Module Title", "classroomDiaries", "Nhật ký lớp học", "en"), "Classroom Diaries");
});
test("typed source-backed mapping registry is immutable, complete and source-keyed", () => {
  assert.ok(pinoLocaleRows.length >= 70, "all actual app nav paths, including expanded BO tree");
  assert.equal(new Set(pinoLocaleRows.map(row => row.key)).size, pinoLocaleRows.length);
  assert.ok(pinoLocaleRows.every(row => row.vi.trim() && row.en.trim()));
  assert.ok(pinoLocaleRows.some(row => row.surface === "BO" && row.kind === "Nav Group"));
  const hoRows = pinoBuildHoLocaleRows({...hoModules,languageMappings:{label:"Language Mapping",group:"System"}});
  assert.ok(hoRows.some(row => row.surface === "HO" && row.kind === "Nav Group"));
  assert.ok(pinoLocaleRows.some(row => row.surface === "BO" && row.kind === "Module Title"));
  assert.ok(hoRows.some(row => row.surface === "HO" && row.kind === "Module Title"));
  assert.ok(pinoLocaleRows.some(row => row.key === "bo.nav.item.classes" && row.en === "Running Class"));
  assert.ok(hoRows.some(row => row.key === "ho.nav.item.languageMappings" && row.vi === "Đối chiếu ngôn ngữ"));
  assert.ok(Object.isFrozen(pinoLocaleRows));
  assert.ok(Object.isFrozen(hoRows));
  assert.ok(hoRows.every(row => Object.isFrozen(row)));
  assert.ok(pinoLocaleRows.every(row => Object.isFrozen(row)));
});
test("search works in both languages and never mutates route/module identity", () => {
  assert.ok(pinoLocaleSearchMatches("bo", "subscriptions", "Subscriptions", "gói học"));
  assert.ok(pinoLocaleSearchMatches("bo", "subscriptions", "Subscriptions", "subscriptions"));
  assert.ok(pinoLocaleSearchMatches("bo", "classes", "Running Classes", "Ca học"));
  assert.ok(!pinoLocaleSearchMatches("bo", "subscriptions", "Subscriptions", "xyz-unmatched"));
  assert.equal(HO_PAGE_PATHS.languageMappings, "/ho/language-mappings");
});
test("BO/HO local storage preferences are separate and no unknown label is invented", () => {
  assert.notEqual(pinoLocaleStorageKey("bo"), pinoLocaleStorageKey("ho"));
  assert.equal(pinoLocalizedLabel("bo", "Nav Item", "x-test", "Unknown Test", "vi"), "Unknown Test");
  assert.equal(pinoLocalizedLabel("bo", "Nav Group", "School", "School", "vi"), "Trường học");
  assert.equal(pinoLocalizedLabel("ho", "Nav Group", "System", "System", "en"), "System");
});
