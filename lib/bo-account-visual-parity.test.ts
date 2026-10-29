import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PAP-1161 BO Shell account footer mirrors HO avatar and logout styling", () => {
  const account = readFileSync("app/bo/shell/BoAuthenticatedAccount.tsx", "utf8");
  const style = readFileSync("app/bo/shell/bo-account.module.css", "utf8");
  const runtime = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  const shared = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx", "utf8");
  assert.match(runtime, /from "@\/app\/bo\/shell\/BoAuthenticatedAccount"/);
  assert.match(account, /resolveBoAccountLabel\(displayName, email\)/);
  assert.match(account, /className=\{styles\.logout\}/);
  assert.match(account, /className=\{styles\.identity\}/);
  assert.match(account, /id="bo-auth-account"/);
  assert.match(account, /<LogoutButton/);
  assert.match(account, /:not\(\[data-surface="ho"\]\)/);
  assert.match(shared, /<div className="sidebar-footer"/);
  assert.match(style, /:global\(#bo-auth-account\) \.avatar\s*\{[^}]*background:\s*#74283e/);
  assert.match(style, /\.logout\s*\{[^}]*background:\s*transparent/);
  assert.match(style, /border:\s*1px solid #dec0cb/);
  assert.match(style, /border-radius:\s*6px/);
  assert.match(style, /padding:\s*5px/);
  assert.match(style, /text-overflow:\s*ellipsis/);
  assert.match(style, /white-space:\s*nowrap/);
  assert.doesNotMatch(style, /(?:^|\n)\s*:global\(\[data-surface="ho"\]\)/);
});
