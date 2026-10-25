import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { BO_SKELETON_HOST, requiresBoStagingPageSession } from "./bo-skeleton-routing";

test("staging anonymous BO pages redirect before any React streaming; no rendered body", () => {
  for (const path of ["/bo", "/bo/", "/bo?module=classes", "/bo/learners"]) {
    const request = new NextRequest("https://" + BO_SKELETON_HOST + path, { headers: { host: BO_SKELETON_HOST } });
    const response = middleware(request);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://" + BO_SKELETON_HOST + "/staff-login");
    assert.equal(response.body, null);
  }
});
test("staging session presence delegates to unchanged server auth; caller marker is replaced", () => {
  const response = middleware(new NextRequest("https://" + BO_SKELETON_HOST + "/bo?module=classes", { headers: { host: BO_SKELETON_HOST, cookie: "pino_staff_password_session=fixture-only", "x-pino-bo-runtime-path": "/forged" } }));
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("x-middleware-request-x-pino-bo-runtime-path"), "/bo");
});
test("staging page presence gate never expands to API/assets, other hosts or lookalikes", () => {
  for (const path of ["/api/bo/context", "/bo-skeleton/styles.css", "/bo-authority-source/styles.css", "/board", "/staff-login"]) assert.equal(requiresBoStagingPageSession(BO_SKELETON_HOST, path), false);
  for (const host of ["bo.pinohouse.art", "tos.pinohouse.art", "pino-team-os.minhtri-van42.workers.dev", BO_SKELETON_HOST + ".evil.example"]) assert.equal(requiresBoStagingPageSession(host, "/bo"), false);
  assert.equal(requiresBoStagingPageSession(BO_SKELETON_HOST, "/bo/learners"), true);
  assert.equal(requiresBoStagingPageSession(BO_SKELETON_HOST.toUpperCase() + ":443", "/bo"), true);
});
