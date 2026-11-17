import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
const effect = source.slice(source.indexOf("if (!mobileOpen) return;"), source.indexOf("}, [mobileOpen]);"));

test("PAP-1987 shared BO/HO mobile nav initially focuses a non-editable enabled control", () => {
  assert.match(effect, /querySelector<HTMLButtonElement>\("\.nav-collapse-actions button:not\(:disabled\)"\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(effect, /querySelector<HTMLInputElement>\("input"\)\?\.focus/);
  assert.match(source, /event\.currentTarget\.focus\(\{ preventScroll: true \}\); setMobileOpen/);
});

test("PAP-1987 preserves mobile navigation search, keyboard trap and close focus restoration", () => {
  assert.match(source, /id="nav-search"[^>]*onChange=/);
  assert.match(effect, /e\.key === "Escape"/);
  assert.match(effect, /e\.key === "Tab"/);
  assert.match(effect, /origin\?\.focus\(\)/);
  assert.doesNotMatch(source, /id="nav-search"[^>]*autoFocus/);
});
