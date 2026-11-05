import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function request(cookie?: string, url = "https://tos.pinohouse.art/dashboard") {
  return new NextRequest(url, { headers: cookie ? { cookie } : {} });
}

test("PAP-989 TOS staging host requires password session and denies BO paths", () => {
  const host = "https://tos.staging.pinohouse.art";
  const anonymous = middleware(request(undefined, host + "/dashboard"));
  assert.equal(anonymous.status, 307);
  assert.equal(anonymous.headers.get("location"), host + "/staff-login");
  const authenticated = middleware(request("pino_staff_password_session=fixture", host + "/dashboard"));
  assert.notEqual(authenticated.status, 307);
  assert.equal(middleware(request(undefined, host + "/bo")).status, 404);
  assert.equal(middleware(request(undefined, host + "/api/bo/context")).status, 404);
});

test("TOS middleware accepts password staff session on protected routes", () => {
  const response = middleware(request("pino_staff_password_session=password-session"));
  assert.notEqual(response.status, 307);
});

test("TOS middleware rejects retired PIN-only session on protected routes", () => {
  const response = middleware(request("pino_staff_session=pin-session"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://tos.pinohouse.art/staff-login");
});

test("TOS middleware accepts governed support session on protected routes", () => {
  const response = middleware(request("pino_support_session=support-session"));
  assert.notEqual(response.status, 307);
});

test("TOS middleware redirects protected routes when neither staff session exists", () => {
  const response = middleware(request());
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://tos.pinohouse.art/staff-login");
});

test("BO middleware accepts password Staff session on BO pages", () => {
  const response = middleware(request("pino_staff_password_session=password-session", "https://bo.pinohouse.art/bo"));
  assert.notEqual(response.status, 307);
});

test("BO middleware redirects BO pages to local Staff login without password session", () => {
  const response = middleware(request(undefined, "https://bo.pinohouse.art/bo/learners"));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://bo.pinohouse.art/staff-login");
});

test("BO retired Users route is unavailable before login", () => {
  assert.equal(middleware(request(undefined, "https://bo.pinohouse.art/bo/system/users")).status, 404);
});

test("BO local Staff login remains public to the application", () => {
  const response = middleware(request(undefined, "https://bo.pinohouse.art/staff-login"));
  assert.notEqual(response.status, 307);
});
