import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("PLT-BO F2 navigation composes School without absorbing domain authority", async () => {
  const source = await read("app/bo/navigation.ts");
  for (const group of ["Workspace", "School", "Operations", "Learning", "Workforce", "Pinoria", "Content", "System"]) {
    assert.match(source, new RegExp(`label: [\\\"']${group}[\\\"']`));
  }
  for (const item of ["Hôm nay", "Students", "Subscriptions", "Classes", "Schedule", "Open Studio", "Programs & Syllabus", "Practice", "Staff", "Schedule & Time", "Economy", "Collection", "Access", "Policies", "Audit"]) {
    assert.match(source, new RegExp(item.replace(/[&]/g, "&")));
  }
  assert.match(source, /href:\s*["']\/bo\/learners["'],\s*label:\s*["']Students["']/);
  assert.match(source, /href:\s*["']\/bo\/running-classes["'],\s*\n\s*label:\s*["']Classes["']/);
  assert.doesNotMatch(source, /label:\s*["']Learners["']/);
  assert.doesNotMatch(source, /label:\s*["']Delivery["']/);
});

test("BO shell keeps contextual subnavigation and responsive navigation separate from TOS", async () => {
  const [shell, tos] = await Promise.all([read("app/components/tos-shell/BoShell.tsx"), read("app/components/tos-shell/TosShell.tsx")]);
  assert.match(shell, /item\.children/);
  assert.match(shell, /commandOpen/);
  assert.match(shell, /menuOpen/);
  assert.match(shell, /usePathname/);
  assert.doesNotMatch(shell, /opsFooter|TosShell|footerItems|\/api\//);
  assert.doesNotMatch(tos, /BoShell|BoNavGroup|BoNavItem/);
});
