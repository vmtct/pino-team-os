import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { TddRegistry, validateQuery } from "./workspace-schema";
import { emptyStaffDraft, manualStaffDefinition, manualStaffFields, manualStaffQuery, validateStaffDraft } from "../app/ho/staff/manual-create-contract";
import { createStaffPreviewRecord, newStaffPreview, readStaffPreview, staffPreviewCenter, staffPreviewSeed } from "../app/ho/staff/manual-create-preview";
const draft = () => ({ ...emptyStaffDraft(), name: "QA Staff", phone: "+84900000002", centerId: staffPreviewCenter.id, loginEmail: "qa@example.invalid" });
test("PAP-2353 requires name, phone, and admitted center; optional login defaults absent", () => {
  assert.equal(validateStaffDraft(emptyStaffDraft(), [staffPreviewCenter], null).ok, false);
  assert.equal(validateStaffDraft({ ...draft(), centerId: "unknown" }, [staffPreviewCenter], null).ok, false);
  const result = validateStaffDraft(draft(), [staffPreviewCenter], null);
  assert(result.ok); assert.equal(result.command.login, null); assert.equal(result.command.phone, "0900000002");
});
test("PAP-2353 login policy rejects mismatches and never projects credentials", () => {
  const secret = randomBytes(16).toString("hex");
  assert.equal(validateStaffDraft(draft(), [staffPreviewCenter], { password: secret, confirmation: "" }).ok, false);
  const result = validateStaffDraft(draft(), [staffPreviewCenter], { password: secret, confirmation: secret });
  assert(result.ok);
  const state = createStaffPreviewRecord(newStaffPreview("qa-principal"), result.command);
  const row = readStaffPreview(state, "STAFF-MOCK-002"); assert(row);
  assert.equal(row.loginEmail, "qa@example.invalid");
  assert.equal(JSON.stringify(row).includes(secret), false);
  assert.equal("password" in row, false);
  assert.throws(() => createStaffPreviewRecord(state, result.command));
  assert.equal(readStaffPreview(state, "real-id"), undefined);
  assert.equal(newStaffPreview("different-principal").records.length, 1);
});
test("PAP-2353 TDD shares registered overview and drawer fields; synthetic audit stays null", () => {
  assert.deepEqual(manualStaffDefinition.drawer.sections, manualStaffDefinition.detail.overview.sections);
  assert(!manualStaffFields.some(field => ["password", "confirmation"].includes(field.key)));
  assert.deepEqual([staffPreviewSeed.createdAt, staffPreviewSeed.createdByUser, staffPreviewSeed.updatedAt, staffPreviewSeed.updatedByUser], [null, null, null, null]);
});

test("PAP-2353 native schema registers and initial query is valid", () => {
  const schema = new TddRegistry().register({ ...manualStaffDefinition, data: { id: "qa-staff-contract", list: async () => ({ rows: [staffPreviewSeed], total: 1 }), detail: async id => id === staffPreviewSeed.id ? staffPreviewSeed : null } });
  validateQuery(schema, manualStaffQuery);
  assert.equal(schema.drawer.sections[0].fields.includes("phone"), true);
});