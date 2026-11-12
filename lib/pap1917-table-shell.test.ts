// PAP-1917 — GLOBAL TABLE SHELL PURITY (Epic PAP-1676 — MISSION ASSIGNMENT).
// Fail-closed BO/HO/TOS list-screen contract: Title → action buttons → Table.
// No persistent explainer/preamble/footer in a Table root. Domain messages in
// Drawer/Detail and conditional ACL/loading/status notices remain supported.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const roots = ["app/bo", "app/ho", "app/tos-v4"] as const; // /tos-v4 is canonical source route.
const moduleTable = /<(?:SurfaceWorkspace|TddRenderer|BoDataTable|\w*DataGrid|table)\b/;
const note = /<p\s+[^>]*\brole=(["'])note\1[^>]*>/g;
// These are not persistent Table descriptions: a conditional attention-mode
// message and a synthetic demo. Exact marker and count assertions prevent abuse.
const outsideProductionTable = {
  "app/bo/workforce/timekeeping/TimekeepingView.tsx": 'mode === "attention" ? <p role="note">',
  "app/ho/system/tdd-reference/ReferenceAtlas.tsx": "TDD Reference — SYNTHETIC DEMO",
} as const;

function findTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? findTsx(full) : entry.isFile() && full.endsWith(".tsx") ? [full] : [];
  });
}
export function persistentTableNotes(text: string): number[] {
  if (!moduleTable.test(text)) return [];
  return Array.from(text.matchAll(note), m => m.index ?? -1);
}

test("PAP-1917 synthetic RED control: preamble and footer both fail; conditional statuses pass", () => {
  assert.deepEqual(persistentTableNotes('<p role="note">Dòng thừa</p><SurfaceWorkspace />'), [0]);
  assert.equal(persistentTableNotes('<SurfaceWorkspace /><p role="note">Dòng thừa</p>').length, 1);
  assert.equal(persistentTableNotes('<BoDataTable /><p role="note">Không có thêm gì</p>').length, 1);
  assert.deepEqual(persistentTableNotes('<SurfaceWorkspace /><p role="status">Đang tải…</p><p role="alert">Không đủ quyền</p>'), []);
  assert.deepEqual(persistentTableNotes('<aside role="note">Help in Full Detail</aside>'), []);
});

test("PAP-1917 canonical shared Table renders Title, Buttons, Table in that order", () => {
  const src = readFileSync("app/components/workspace-renderer/Renderer.tsx", "utf8");
  const start = src.indexOf('case "table": return <section id="list-screen">');
  const end = src.indexOf('case "drawer":', start);
  assert.ok(start >= 0 && end > start, "canonical Table renderer must exist");
  const table = src.slice(start, end);
  assert.match(table, /className="page-heading"/);
  assert.match(table, /<h1>[\s\S]*<\/h1>/);
  assert.match(table, /data-tdd-action-region="table\.header"/);
  assert.match(table, /<TddActionHost\b[^>]*slot="table\.header"/);
  assert.match(table, /<TddTable\b/);
  assert.doesNotMatch(table, /<(?:p|aside)\b|role="note"|className="[^"]*(?:subtitle|description|preamble)/);
  assert.ok(table.indexOf('className="page-heading"') < table.indexOf("<TddTable"), "Title/Buttons must precede Table");
});

test("PAP-1917 BO/HO/TOS production Table modules have ZERO persistent explanatory notes", () => {
  const failures: string[] = [];
  let scanned = 0;
  for (const root of roots) {
    for (const path of findTsx(root)) {
      const key = relative(".", path).split(sep).join("/");
      const source = readFileSync(path, "utf8");
      if (!moduleTable.test(source)) continue;
      scanned++;
      const matches = persistentTableNotes(source);
      const special = (outsideProductionTable as Record<string, string>)[key];
      if (special) {
        if (!source.includes(special) || matches.length !== 1) {
          failures.push(key + ": conditional/demo exemption changed or unexpected Table note added");
        }
        continue;
      }
      if (matches.length) failures.push(key + ": " + matches.length + " unconditional Table note(s)");
    }
  }
  assert.ok(scanned > 10, "Cross-surface Table source scan coverage unexpectedly dropped");
  assert.deepEqual(failures, [], "PINO Table = Title + Buttons + Table. No top or bottom module description, no legacy exceptions.");
});
