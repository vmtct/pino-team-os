import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { callTosLearningCoreWithCredential } from "./tos-learning-core";

const source = readFileSync(new URL("../app/api/tos-learning/[...path]/route.ts", import.meta.url), "utf8");

test("operator facade forwards identity and idempotency to Core, never TV runtime", async () => {
  const calls: unknown[] = [];
  const binding = {
    executeWithStaffPassword: async (request: unknown, token: string) => {
      calls.push({ request, token });
      return { status: 201, body: { data: { accepted: true } }, requestId: "receipt" };
    },
  };
  const request = {
    method: "POST", path: "/pinoria/presentations/replay-dispatch",
    body: { centerId: "center", displayId: "display", presentationId: "presentation" },
    idempotencyKey: "replay-key",
  };
  const response = await callTosLearningCoreWithCredential(binding, request, { kind: "password", token: "staff-token" });
  assert.equal(response.status, 201);
  assert.deepEqual(calls, [{ request, token: "staff-token" }]);
  assert.match(source, /request\.headers\.get\("idempotency-key"\)/);
  assert.match(source, /callTosLearningCoreWithCredential\(/);
  assert.match(source, /await teamCredential\(request, env, "TOS"\)/);
  assert.doesNotMatch(source, /PINO_TV_RUNTIME_CORE/);
});

test("operator facade preserves Core read and command paths", () => {
  assert.match(source, /const normalizedPath = path\.join\("\/"\)/);
  assert.match(source, /path: `\/\$\{normalizedPath\}`/);
  assert.match(source, /method: request\.method/);
  assert.match(source, /idempotencyKey \? \{ idempotencyKey \} : \{\}/);
});
