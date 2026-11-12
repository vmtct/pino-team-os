// PAP-1914 / Epic PAP-1705 PNR-AVATAR-CRUD — exact Staging BO Nickname route fence.
import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";

const bo = "bo.staging.pinohouse.art";
const base = "/api/bo/pinoria/avatars";
const self = "01a1c803-2b24-740a-8e9b-6dbfcedd107b";
const exact = base + "/" + self;

test("PAP-1914 permits ONLY exact v7 Avatar Nickname PATCH on BO Staging", () => {
  assert.deepEqual(decideHostBoundary(bo, exact, "PATCH"), { action: "next" });
  for (const method of ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
    assert.deepEqual(decideHostBoundary(bo, exact, method), { action: "not_found" }, method);
  for (const host of [
    "bo.pinohouse.art", "ho.staging.pinohouse.art",
    "tos.staging.pinohouse.art", "join.pinohouse.art",
    "bo.staging.pinohouse.art.evil.example"
  ])
    assert.deepEqual(decideHostBoundary(host, exact, "PATCH"), { action: "not_found" }, host);
});

test("PAP-1914 rejects malformed/non-v7 Avatar child, suffix and encoding bypass", () => {
  for (const path of [
    base + "/not-a-uuid",
    base + "/" + self.replace("-740a-", "-640a-"),
    base + "/" + self.replace("-8e9b-", "-0e9b-"),
    exact + "/", exact + "/edit", exact + "%2Fextra",
    base + "//" + self, base + "/" + self + "/../" + self
  ])
    assert.deepEqual(decideHostBoundary(bo, path, "PATCH"), { action: "not_found" }, path);
});

test("PAP-1914 preserves existing GET/POST directory and rejects extra writes", () => {
  for (const method of ["GET", "POST"])
    assert.deepEqual(decideHostBoundary(bo, base, method), { action: "next" }, method);
  for (const method of ["PATCH", "PUT", "DELETE", "HEAD"])
    assert.deepEqual(decideHostBoundary(bo, base, method), { action: "not_found" }, method);
});
