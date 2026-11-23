import assert from "node:assert/strict";
import test from "node:test";
import {
  LEAD_M1_AUDIT_COLUMNS,
  LEAD_M1_FIXTURE,
  LEAD_M1_INTEREST_LABELS,
  leadM1MemberSummary,
  leadM1SearchText,
} from "../app/bo/sales/leads/lead-household-m1-fixtures";

test("PAP-2286 M1 preview is one Lead aggregate with a three-role household", () => {
  const lead = LEAD_M1_FIXTURE;
  assert.equal(lead.id, "LEAD-MOCK-001");
  assert.equal(lead.fixture, true);
  assert.equal(lead.members.length, 3);
  assert.deepEqual(lead.members.map(member => member.roles[0]), ["PARENT", "STUDENT", "GUEST"]);
  assert.equal(leadM1MemberSummary(lead), "1 Parent · 1 Student · 1 Guest");
});

test("PAP-2286 M1 relationship candidates are directed declarations only", () => {
  const lead = LEAD_M1_FIXTURE;
  assert.equal(lead.relationships.length, 2);
  for (const relation of lead.relationships) {
    assert.equal(relation.status, "DECLARED");
    const parent = lead.members.find(member => member.id === relation.fromMemberId);
    const child = lead.members.find(member => member.id === relation.toMemberId);
    assert.ok(parent?.roles.includes("PARENT"));
    assert.ok(child?.roles.includes("STUDENT") || (child?.roles.includes("GUEST") && child.age !== null && child.age < 18));
  }
});

test("PAP-2286 M1 keeps program and discipline pairing in four distinct intents", () => {
  const lead = LEAD_M1_FIXTURE;
  assert.deepEqual(lead.intents.map(intent => intent.kind), ["AFTERSCHOOL_ART", "AFTERSCHOOL_PIANO", "MYTIME_ACRYLIC", "MYTIME_PIANO"]);
  assert.equal(LEAD_M1_INTEREST_LABELS.MYTIME_ACRYLIC, "MyTime · Hội họa");
  assert.equal(LEAD_M1_INTEREST_LABELS.AFTERSCHOOL_PIANO, "Afterschool · Piano");
});

test("PAP-2286 M1 audit manifest declares all four fields without fabricated fixture values", () => {
  const lead = LEAD_M1_FIXTURE;
  assert.deepEqual(LEAD_M1_AUDIT_COLUMNS.map(column => column.key), ["createdAt", "createdBy", "updatedAt", "updatedBy"]);
  assert.deepEqual([lead.createdAt, lead.createdBy, lead.updatedAt, lead.updatedBy], [null, null, null, null]);
  assert.ok(LEAD_M1_AUDIT_COLUMNS.every(column => column.fallback === "—"));
});

test("PAP-2286 M1 fixture search is Lead-centric and includes household/intents", () => {
  const searchText = leadM1SearchText(LEAD_M1_FIXTURE);
  assert.match(searchText, /nguyễn minh khuê/);
  assert.match(searchText, /guest/);
  assert.match(searchText, /mytime · piano/);
  assert.match(searchText, /0900000000/);
});
