import assert from "node:assert/strict";
export const BO = "https://bo.staging.pinohouse.art";
export const HO = "https://ho.staging.pinohouse.art";
export const COLLECTION = "/api/bo/views/subscriptions";
export const FIXTURE_NAME = "PAP-1105 Freeze acceptance retained fixture";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function fixtureConfig(boundary = null) {
  return { search: "", sort: null, filters: [], logic: "and", groupBy: null, hideEmptyGroups: true,
    columns: { order: ["pathDisplayName", "lifecycle"], visible: ["pathDisplayName", "lifecycle"], frozenThrough: boundary } };
}
function row(value) {
  assert(value && UUID.test(value.id) && value.moduleKey === "subscriptions" && value.name === FIXTURE_NAME);
  assert(Number.isSafeInteger(value.version) && value.version > 0);
  const boundary = value.config?.columns?.frozenThrough;
  assert(boundary === null || boundary === "lifecycle");
  assert.deepEqual(value.config, fixtureConfig(boundary)); // Exact owned fixture shape; never adopt a user View.
  return value;
}
export function allowedRequest(url, method, body, permit) {
  const u = new URL(url);
  if (![BO, HO].includes(u.origin) || u.username || u.password) return false;
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  if (!permit || u.origin !== BO || u.search || u.hash ||
      !["POST", "PATCH"].includes(method) || method !== permit.method ||
      u.pathname !== permit.path || body !== JSON.stringify(permit.body)) return false;
  return u.pathname === COLLECTION && method === "POST" && permit.body.name === FIXTURE_NAME ||
    method === "PATCH" && UUID.test(u.pathname.slice(COLLECTION.length + 1)) &&
      u.pathname === COLLECTION + "/" + permit.id;
}
export async function verifyFreezePersistence(api, {onFixture = () => {}} = {}) {
  const list = async () => {
    const r = await api("GET", COLLECTION);
    assert.equal(r.status, 200); assert(Array.isArray(r.data) && r.data.length <= 120);
    return r.data;
  };
  const matches = (await list()).filter(v => v.name === FIXTURE_NAME);
  assert(matches.length <= 1, "Ambiguous fixture");
  let current, created = false, changed = false;
  if (matches.length) current = row(matches[0]);
  else {
    const r = await api("POST", COLLECTION, { name: FIXTURE_NAME, config: fixtureConfig() });
    assert([200, 201].includes(r.status)); current = row(r.data); created = true;
  }
  onFixture({fixtureId:current.id,created,retained:true});
  const original = structuredClone(current.config);
  const id = current.id;
  const patch = async config => {
    const before = current.version;
    const r = await api("PATCH", COLLECTION + "/" + id, { expectedVersion: before, config }, id);
    assert.equal(r.status, 200);
    // Keep the acknowledged version for bounded rollback even when a server strips metadata.
    assert(r.data?.id === id && Number.isSafeInteger(r.data.version) && r.data.version > before);
    current = r.data; changed = true; row(current);
  };
  const readback = async () => {
    const found = row((await list()).find(v => v.id === id));
    assert.equal(found.version, current.version); assert.deepEqual(found.config, current.config);
  };
  try {
    const oldVersion = current.version;
    await patch(fixtureConfig("lifecycle"));
    assert.equal(current.config.columns.frozenThrough, "lifecycle"); await readback();
    const legacy = fixtureConfig(); delete legacy.columns.frozenThrough;
    await patch(legacy);
    assert.equal(current.config.columns.frozenThrough, "lifecycle"); await readback();
    const conflict = await api("PATCH", COLLECTION + "/" + id,
      { expectedVersion: oldVersion, config: fixtureConfig() }, id);
    assert.equal(conflict.status, 409); await readback();
    for (const invalid of ["id", "pathDisplayName", "not-a-registered-field"]) {
      const rejected = await api("PATCH", COLLECTION + "/" + id,
        { expectedVersion: current.version, config: fixtureConfig(invalid) }, id);
      assert.equal(rejected.status, 400); await readback();
    }
    await patch(fixtureConfig());
    assert.equal(current.config.columns.frozenThrough, null); await readback();
  } finally {
    if (changed) {
      // CAS against only our last acknowledged version; no retry or overwrite of another writer.
      const restored = await api("PATCH", COLLECTION + "/" + id,
        { expectedVersion: current.version, config: original }, id);
      assert.equal(restored.status, 200); current = row(restored.data);
      assert.deepEqual(current.config, original); await readback();
    }
  }
  return { fixtureId: id, created, retained: true, restored: true, version: current.version };
}
