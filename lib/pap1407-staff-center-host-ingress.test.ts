// PAP-1407 / PAP-220 — exact BO & HO Staff Center paths at middleware ingress.
import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";

const bo = "bo.staging.pinohouse.art";
const ho = "ho.staging.pinohouse.art";
const id = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const list = "/api/bo/workforce/staff-center-registration-requests";
const detail = list + "/" + id;
const links = "/api/ho/staff-center-links/" + id;
const status = links + "/status";
const next = { action: "next" };
const denied = { action: "not_found" };

test("PAP-1407: only exact BO GET Staff Center list/detail enters BFF", () => {
  for (const path of [list, detail]) {
    assert.deepEqual(decideHostBoundary(bo, path, "GET"), next, path);
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
      assert.deepEqual(decideHostBoundary(bo, path, method), denied, method + " " + path);
  }
  for (const path of [list + "/", detail + "/extra", detail + "/approve",
    detail + "/history", list + "/invalid", list + "//" + id, list + "%2F" + id]) {
    assert.deepEqual(decideHostBoundary(bo, path, "GET"), denied, path);
  }
});
test("PAP-1407: only HO Founder exact link read and CAS status write enter BFF", () => {
  assert.deepEqual(decideHostBoundary(ho, links, "GET"), next);
  assert.deepEqual(decideHostBoundary(ho, status, "POST"), next);
  for (const method of ["POST", "PATCH", "DELETE", "PUT", "HEAD", "OPTIONS"])
    assert.deepEqual(decideHostBoundary(ho, links, method), denied, method);
  for (const method of ["GET", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"])
    assert.deepEqual(decideHostBoundary(ho, status, method), denied, method);
  for (const path of ["/api/ho/staff-center-links", links + "/", links + "/approve",
    status + "/extra", "/api/ho/staff-center-links/invalid", links + "%2Fstatus"]) {
    assert.deepEqual(decideHostBoundary(ho, path, "GET"), denied, path);
    assert.deepEqual(decideHostBoundary(ho, path, "POST"), denied, path);
  }
});
test("PAP-1407: isolation never admits Staff Center endpoints on BO production, TOS, JOIN or opposite surface", () => {
  for (const host of [ "bo.pinohouse.art", "ho.pinohouse.art",
    "tos.staging.pinohouse.art", "tos.pinohouse.art", "join.pinohouse.art",
    "pino-team-os-staging.minhtri-van42.workers.dev",
    "ho.staging.pinohouse.art.evil.example" ]) {
    assert.deepEqual(decideHostBoundary(host, list, "GET"), denied, host);
    assert.deepEqual(decideHostBoundary(host, detail, "GET"), denied, host);
    assert.deepEqual(decideHostBoundary(host, links, "GET"), denied, host);
    assert.deepEqual(decideHostBoundary(host, status, "POST"), denied, host);
  }
  assert.deepEqual(decideHostBoundary(bo, links, "GET"), denied);
  assert.deepEqual(decideHostBoundary(ho, list, "GET"), denied);
});
