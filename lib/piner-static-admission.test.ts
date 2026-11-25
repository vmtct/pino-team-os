import assert from "node:assert/strict";
import test from "node:test";
import { decidePinerStaticM1, type PinerStaticAdmission } from "./m1-preview/piner-static-admission";
const sourceRevision = "a".repeat(40);
const sha256 = "b".repeat(64);
function input(route = "/piner/house", program: "house" | "mytime" = "house"): PinerStaticAdmission {
  const registration = { route, fixtureId: "PORTFOLIO-MOCK-001", photoCount: 2, sourceRevision, sha256 };
  return { environment: "staging", featureEnabled: true, requestUrl: "https://app.staging.pinohouse.art" + route,
    method: "GET", registration, verifiedArtifact: { ...registration }, approvedSourceRevision: sourceRevision,
    proof: { authenticated: true, surfaceAuthorized: true, featureReviewAuthorized: true, scopeAuthorized: true, program } };
}
test("static contract: only four registered product routes, GET/HEAD and bounded deep link", () => {
  for (const program of ["house", "mytime"] as const) {
    for (const route of ["/piner/" + program, "/piner/" + program + "/grid"]) {
      const i = input(route, program);
      assert.deepEqual(decidePinerStaticM1(i), { allowed: true, route, program, photo: 1 });
      assert.deepEqual(decidePinerStaticM1({ ...i, method: "HEAD" }), { allowed: true, route, program, photo: 1 });
      assert.deepEqual(decidePinerStaticM1({ ...i, requestUrl: i.requestUrl + "?post=PORTFOLIO-MOCK-001&photo=2" }), { allowed: true, route, program, photo: 2 });
    }
  }
});
test("disabled by default; production and foreign hosts never admitted", () => {
  const i = input();
  for (const change of [{ environment: "production" }, { environment: undefined }, { featureEnabled: false },
    { requestUrl: "https://app.pinohouse.art/piner/house" }, { requestUrl: "http://app.staging.pinohouse.art/piner/house" },
    { requestUrl: "https://app.staging.pinohouse.art.evil.invalid/piner/house" }, { requestUrl: "not a URL" }]) {
    assert.deepEqual(decidePinerStaticM1({ ...i, ...change } as PinerStaticAdmission), { allowed: false, reason: "disabled" });
  }
});
test("only real independent server proofs; no implicit MyTime or profile authority", () => {
  const i = input();
  assert.deepEqual(decidePinerStaticM1({ ...i, proof: undefined } as unknown as PinerStaticAdmission), { allowed: false, reason: "unauthenticated" });
  assert.deepEqual(decidePinerStaticM1({ ...i, proof: { ...i.proof!, authenticated: false } }), { allowed: false, reason: "unauthenticated" });
  for (const key of ["surfaceAuthorized", "featureReviewAuthorized", "scopeAuthorized"] as const) {
    assert.deepEqual(decidePinerStaticM1({ ...i, proof: { ...i.proof!, [key]: false } }), { allowed: false, reason: "forbidden" });
    const partial = { ...i.proof! }; delete (partial as Partial<typeof partial>)[key];
    assert.deepEqual(decidePinerStaticM1({ ...i, proof: partial }), { allowed: false, reason: "forbidden" });
  }
  assert.deepEqual(decidePinerStaticM1({ ...i, proof: { ...i.proof!, program: "mytime" } }), { allowed: false, reason: "forbidden" });
});
test("unregistered nav and write routes are outside fixture admission", () => {
  const i = input();
  for (const path of ["/piner", "/piner/preview", "/piner/house/", "/piner/house/reels", "/piner/mytime/community", "/api/piner/afterschool/session"]) {
    assert.deepEqual(decidePinerStaticM1({ ...i, requestUrl: "https://app.staging.pinohouse.art" + path }), { allowed: false, reason: "not_registered" });
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) assert.deepEqual(decidePinerStaticM1({ ...i, method }), { allowed: false, reason: "method" });
});
test("artifact must be route-bound, verified, pinned and match approved source", () => {
  const i = input();
  const variations = [{ registration: undefined }, { verifiedArtifact: undefined }, { approvedSourceRevision: "c".repeat(40) },
    { verifiedArtifact: { ...i.verifiedArtifact!, sha256: "c".repeat(64) } }, { verifiedArtifact: { ...i.verifiedArtifact!, route: "/piner/mytime" } },
    { verifiedArtifact: { ...i.verifiedArtifact!, photoCount: 3 } }, { registration: { ...i.registration!, fixtureId: "real-id" } },
    { registration: { ...i.registration!, photoCount: 0 } }, { registration: { ...i.registration!, photoCount: 6 } }];
  for (const change of variations) assert.deepEqual(decidePinerStaticM1({ ...i, ...change } as PinerStaticAdmission), { allowed: false, reason: "artifact_mismatch" });
});
test("query never activates preview or selects real or unbounded data", () => {
  const i = input();
  for (const q of ["?m1Preview=1", "?post=PORTFOLIO-MOCK-001", "?photo=1", "?post=real-id&photo=1",
    "?post=PORTFOLIO-MOCK-001&photo=3", "?post=PORTFOLIO-MOCK-001&photo=01", "?post=PORTFOLIO-MOCK-001&photo=0",
    "?post=PORTFOLIO-MOCK-001&photo=1&photo=2", "?post=PORTFOLIO-MOCK-001&photo=1&profile=real"]) {
    assert.deepEqual(decidePinerStaticM1({ ...i, requestUrl: i.requestUrl + q }), { allowed: false, reason: "invalid_state" });
  }
});
