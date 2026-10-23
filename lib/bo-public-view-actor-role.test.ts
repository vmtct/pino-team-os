import assert from "node:assert/strict";
import test from "node:test";
import { boPublicViewActorRole } from "./bo-public-view-actor-role";
import type { BoContext } from "./bo-model";

const actor = (permissionKeys: string[]): BoContext => ({
  userId: "actor", email: "actor@example.invalid", staffMemberId: null,
  displayName: null, staffProfile: null, surface: "BO", entitled: true, permissionKeys,
});

test("shared views Manager requires BOTH module read and explicit manage", () => {
  assert.equal(boPublicViewActorRole(actor(["student.profile.view", "bo.shared_view.manage"]), "student.profile.view"), "manager");
  assert.equal(boPublicViewActorRole(actor(["student.profile.view"]), "student.profile.view"), "staff");
});
test("fail closed on absent read or absent actor", () => {
  assert.equal(boPublicViewActorRole(actor(["bo.shared_view.manage"]), "student.profile.view"), null);
  assert.equal(boPublicViewActorRole(actor(["team.bo.access"]), "student.profile.view"), null);
  assert.equal(boPublicViewActorRole(null, "student.profile.view"), null);
});
