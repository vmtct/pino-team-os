import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function request(cookie?: string) {
  return new NextRequest("https://tos.pinohouse.art/dashboard", { headers: cookie ? { cookie } : {} });
}

test("TOS middleware accepts password staff session on protected routes", () => {
  const response = middleware(request("pino_staff_password_session=password-session"));
  assert.notEqual(response.status, 307);
});

test("TOS middleware still accepts PIN staff session on protected routes", () => {
  const response = middleware(request("pino_staff_session=pin-session"));
  assert.notEqual(response.status, 307);
});

test("TOS middleware redirects protected routes when neither staff session exists", () => {
  const response = middleware(request());
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://tos.pinohouse.art/staff-login");
});
