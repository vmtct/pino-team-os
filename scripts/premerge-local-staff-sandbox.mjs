#!/usr/bin/env node
/**
 * PAP-781 LOCAL UI E2E only. This deliberately replaces BO layout and index
 * in a disposable DETACHED worktree, NEVER the candidate/FC1/main worktree.
 * Runtime remains loopback and API calls must be intercepted by Playwright.
 * Do not use this for integration, credentials, staging or Production.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const operation = process.argv[2];
const root = process.cwd();
if (!["prepare", "restore"].includes(operation)) throw new Error("Use prepare or restore");
if (path.basename(root).toLowerCase() !== "pap781-ui-e2e-sandbox")
  throw new Error("REFUSE: requires disposable directory named pap781-ui-e2e-sandbox");
const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (branch !== "HEAD") throw new Error("REFUSE: sandbox must be detached HEAD, never a shared branch");
const paths = ["app/bo/layout.tsx", "app/bo/staff/page.tsx", "playwright.premerge.config.ts"];
for (const file of paths) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) throw new Error("Missing sandbox candidate source: " + file);
  const original = execFileSync("git", ["show", "HEAD:" + file], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (operation === "restore") {
    fs.writeFileSync(full, original, "utf8");
  } else {
    let fixture;
    if (file === "app/bo/layout.tsx") fixture = [
      "/** PAP-781 LOCAL UI sandbox fixture — NOT candidate auth. */",
      'export const dynamic = "force-dynamic";',
      'export default function BoLayout({ children }: { children: React.ReactNode }) {',
      '  return <main style={{ padding: 16, minHeight: "100vh", background: "#f6f4f9" }}>{children}</main>;',
      '}', "",
    ].join("\n");
    else if (file === "app/bo/staff/page.tsx") fixture = [
      "/** PAP-781 LOCAL UI sandbox only — StaffManagementView is exact candidate source. */",
      'import { StaffManagementView } from "./StaffManagementView";',
      'export default function StaffPage() { return <StaffManagementView />; }', "",
    ].join("\n");
    else {
      fixture = original.replace('url: "http://127.0.0.1:3109/",', "port: 3109,")
        .replace("timeout: 120000,", "timeout: 300000,")
        .replace("fullyParallel: false,", "fullyParallel: false,\n  timeout: 120000,");
      if (!fixture.includes("port: 3109") || !fixture.includes("timeout: 300000"))
        throw new Error("Unexpected Playwright config; do not apply unsafe fixture");
    }
    fs.writeFileSync(full, fixture, "utf8");
  }
}
process.stdout.write("PAP-781 sandbox " + operation + " complete. Production authentication untouched.\n");
