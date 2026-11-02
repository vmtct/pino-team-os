import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyTddRendererOwnership } from "./tdd-renderer-ownership";
test("PR2 compatibility bridges have one shared shell owner", () => assert.deepEqual(verifyTddRendererOwnership(), []));
test("duplicate shells and orphaned bridges fail the scoped ownership gate", () => {
  const source = (path: string) => readFileSync(path, "utf8");
  const target = "app/bo/components/registration/BoFullDetail.tsx";
  assert.ok(verifyTddRendererOwnership(path => source(path) + (path === target ? '\nconst fork = <div className={"detail-cover"}>Fork</div>;' : "")).some(message => message.includes("duplicate shell")));
  assert.ok(verifyTddRendererOwnership(path => path === target ? 'export const BoFullDetail = () => <section />;' : source(path)).some(message => message.includes("missing DetailFrame")));
});
