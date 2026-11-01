import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { boCenterWave1Href, isBoCenterReadWave1 } from "../app/bo/components/registration/BoCenterWave1";
import { scopedClassesFetcher } from "../app/bo/components/registration/BoScopedClassRead";

const { load } = createRequire(import.meta.url)("../public/bo-authority-source/school-adapters.js");
const A = "0199f001-0000-7000-8000-000000000001";
const B = "0199f001-0000-7000-8000-000000000002";
const ID = "0199f001-0000-7000-8000-000000000003";
const data = (centerId: string) => ({
  centers: [{ id: centerId, displayName: "Scoped Center", timeZone: "Asia/Ho_Chi_Minh" }],
  paths: [{ id: ID, displayName: "Art" }],
  runningClasses: [{
    id: ID, centerId, pathProgramId: ID, operationalName: "Art Class",
    weekdayIso: 1, windowStartsLocal: "18:00", windowEndsLocal: "19:30",
    optimalConcurrentCapacity: 12, deliveryTopology: "SINGLE", status: "ACTIVE",
  }],
});
const ok = (payload: unknown) => new Response(JSON.stringify({ data: payload }), { status: 200 });

test("PAP-1328: Classes is adopted only with an explicit Core-authorized Center", async () => {
  assert.equal(isBoCenterReadWave1("classes"), true);
  const urls: string[] = [];
  const rows = await load("classes", scopedClassesFetcher(async (url: string) => {
    urls.push(url);
    return ok(data(A));
  }, A), { centerId: A });
  assert.deepEqual(urls, ["/api/bo/delivery/bootstrap-state?centerId=" + A]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Art Class");
  assert.equal(
    boCenterWave1Href("/bo?module=classes&record=old#details", "classes", A, [A]),
    "/bo?module=classes&centerId=" + A,
  );
});

test("PAP-1328: foreign Center response cannot appear in a selected-Center Class table", async () => {
  await assert.rejects(
    load("classes", scopedClassesFetcher(async () => ok(data(B)), A), { centerId: A }),
    /khác cơ sở/,
  );
  await assert.rejects(
    load("classes", scopedClassesFetcher(async () => ok({ ...data(A), centers: [data(B).centers[0]] }), A), { centerId: A }),
    /khác cơ sở/,
  );
});

test("PAP-1328: explicit Center 403 never falls back to another Center or GLOBAL", async () => {
  const urls: string[] = [];
  await assert.rejects(load("classes", scopedClassesFetcher(async (url: string) => {
    urls.push(url);
    return new Response(null, { status: 403 });
  }, A), { centerId: A }), /Core từ chối/);
  assert.deepEqual(urls, ["/api/bo/delivery/bootstrap-state?centerId=" + A]);
  assert.equal(
    boCenterWave1Href("/bo?module=classes", "classes", B, [A]),
    "/bo?module=classes",
  );
});
