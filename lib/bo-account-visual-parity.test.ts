import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("PAP-1161 BO Shell account footer mirrors HO without an unauthorized stylesheet", () => {
  const account = readFileSync("app/bo/shell/BoAuthenticatedAccount.tsx", "utf8");
  const runtime = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  const shared = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
  assert.match(runtime, /from "@\/app\/bo\/shell\/BoAuthenticatedAccount"/);
  assert.match(account, /resolveBoAccountLabel\(displayName, email\)/);
  assert.match(account, /<LogoutButton \/>/);
  assert.match(account, /id="bo-auth-account"/);
  assert.match(account, /<style>\{BO_ACCOUNT_STYLES\}<\/style>/);
  assert.match(account, /:not\(\[data-surface="ho"\]\)/);
  assert.match(shared, /<div className="sidebar-footer"/);
  assert.match(account, /#bo-auth-account > \.avatar \{ background: #74283e; color: #fff;/);
  assert.match(account, /#bo-auth-account > button \{ background: transparent; border: 1px solid #dec0cb; border-radius: 6px;/);
  assert.match(account, /padding: 5px; white-space: nowrap;/);
  assert.match(account, /text-overflow: ellipsis; white-space: nowrap/);
  assert.match(account, /:focus-visible/);
  assert.equal(existsSync("app/bo/shell/bo-account.module.css"), false);
});
