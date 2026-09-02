import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("PLT-BO canonical navigation is responsibility-oriented rather than route inventory", async () => {
  const source = await read("app/bo/navigation.ts");
  for (const group of ["Workspace", "Operations", "Learning", "Workforce", "Pinoria", "System"]) {
    assert.match(source, new RegExp(`label: [\\\"']${group}[\\\"']`));
  }
  for (const item of ["Hôm nay", "Learners", "Delivery", "Open Studio", "Programs & Syllabus", "Practice", "Staff", "Schedule & Time", "Economy", "Collection", "Access", "Policies", "Audit"]) {
    assert.match(source, new RegExp(item.replace(/[&]/g, "&")));
  }
  assert.doesNotMatch(source, /label:\s*["']Running Classes["']/);
  assert.doesNotMatch(source, /label:\s*["']Delivery Activation["']/);
});

test("BO shell keeps contextual subnavigation and responsive navigation separate from TOS", async () => {
  const [shell, tos] = await Promise.all([
    read("app/components/tos-shell/BoShell.tsx"),
    read("app/components/tos-shell/TosShell.tsx"),
  ]);
  assert.match(shell, /item\.children/);
  assert.match(shell, /commandOpen/);
  assert.match(shell, /menuOpen/);
  assert.match(shell, /usePathname/);
  assert.doesNotMatch(shell, /opsFooter|TosShell|footerItems|\/api\//);
  assert.doesNotMatch(tos, /BoShell|BoNavGroup|BoNavItem/);
});