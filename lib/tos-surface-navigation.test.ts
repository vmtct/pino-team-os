import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  TOS_CLASSROOM_FOOTER,
  TOS_HOME_FOOTER,
  TOS_OPEN_STUDIO_FOOTER,
  TOS_TASKS_FOOTER,
  TOS_PINORIA_FOOTER,
  TOS_SHIFT_FOOTER,
} from "../app/components/tos-shell/navigation";
import { requiresTosStaffSession } from "./host-boundary";

const contextual = [
  TOS_SHIFT_FOOTER,
  TOS_CLASSROOM_FOOTER,
  TOS_PINORIA_FOOTER,
  TOS_OPEN_STUDIO_FOOTER,
  TOS_TASKS_FOOTER,
];

test("TOS Home is the neutral app-family launcher", async () => {
  assert.deepEqual(TOS_HOME_FOOTER.map((item) => item.id), ["home", "shift", "classroom", "tasks", "pinoria"]);
  assert.equal(TOS_HOME_FOOTER.length <= 5, true);
  assert.equal(TOS_HOME_FOOTER.some((item) => item.href === "/open-studio"), false);
  const source = await readFile("app/page.tsx", "utf8");
  assert.match(source, /<TosHome\s*\/>/);
  assert.match(source, /dynamic\s*=\s*"force-dynamic"/);
  assert.doesNotMatch(source, /redirect\("\/dashboard/);
});

test("contextual app footers replace Home navigation", () => {
  for (const footer of contextual) {
    assert.equal(footer.length <= 5, true);
    assert.equal(footer.some((item) => item.id === "home" || item.href === "/"), false);
  }
  assert.deepEqual(TOS_SHIFT_FOOTER.map((item) => item.id), ["today", "schedule", "register", "check", "history"]);
  assert.deepEqual(TOS_SHIFT_FOOTER.map((item) => item.href), ["/dashboard", "/schedule", "/availability", "/check-in", "/timesheet"]);
  assert.deepEqual(TOS_PINORIA_FOOTER.map((item) => item.id), ["presence", "attendance"]);
});

test("new TOS app routes stay inside the staff-session perimeter", () => {
  assert.equal(requiresTosStaffSession("tos.pinohouse.art", "/tasks"), true);
  assert.equal(requiresTosStaffSession("tos.pinohouse.art", "/availability"), true);
  assert.equal(requiresTosStaffSession("bo.pinohouse.art", "/tasks"), false);
});

test("TOS consumers use centralized domain navigation instead of global route footers", async () => {
  const files = [
    "app/components/WorkforceWorkspace.tsx",
    "app/classroom/ClassroomView.tsx",
    "app/pinoria/arrival-desk.tsx",
    "app/pinoria/attendance/attendance-desk.tsx",
    "app/open-studio/OpenStudioDesk.tsx",
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /label:\s*"Home"/);
  assert.doesNotMatch(source, /const footer\s*=/);
  assert.match(source, /TOS_SHIFT_FOOTER/);
  assert.match(source, /TOS_CLASSROOM_FOOTER/);
  assert.match(source, /TOS_PINORIA_FOOTER/);
  assert.match(source, /TOS_OPEN_STUDIO_FOOTER/);
});
