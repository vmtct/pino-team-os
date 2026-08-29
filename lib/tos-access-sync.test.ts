import test from "node:test";
import assert from "node:assert/strict";
import { reconcileCanonicalTosAccess } from "./tos-access-sync";
import type { VerifiedBoIdentity } from "./bo-auth";

const identity: VerifiedBoIdentity = {
  provider: "cloudflare_access",
  subject: "founder",
  email: "founder@example.com",
  issuer: "https://team.cloudflareaccess.com",
  audience: ["bo"],
  expiresAt: Math.floor(Date.now() / 1000) + 300,
};

test("reconciles only active canonical staff with active Access and non-Founder roles", async () => {
  const calls: string[] = [];
  const core = {
    async execute(request: { path: string }) {
      calls.push(request.path);
      if (request.path === "workforce/staff-records") return { status: 200, requestId: "staff", body: { data: [
        { id: "staff-a", status: "active" }, { id: "staff-b", status: "inactive" }, { id: "staff-c", status: "active" },
      ] } };
      return { status: 200, requestId: "users", body: { data: [
        { staffMemberId: "staff-a", status: "active", email: " A@Example.com ", assignments: [{ roleKey: "mentor" }] },
        { staffMemberId: "staff-b", status: "active", email: "b@example.com", assignments: [{ roleKey: "mentor" }] },
        { staffMemberId: "staff-c", status: "suspended", email: "c@example.com", assignments: [{ roleKey: "mentor" }] },
        { staffMemberId: "staff-c", status: "active", email: "founder@example.com", assignments: [{ roleKey: "founder" }] },
      ] } };
    },
  };  let emails: string[] = [];
  const sync = { async reconcile(input: { emails: string[] }) { emails = input.emails; return { state: "updated", emailCount: emails.length, policyId: "policy" }; } };
  const result = await reconcileCanonicalTosAccess(core, sync, identity);
  assert.deepEqual(calls.sort(), ["access/users", "workforce/staff-records"]);
  assert.deepEqual(emails, ["a@example.com"]);
  assert.equal(result.emailCount, 1);
});

test("fails closed when canonical projections are malformed", async () => {
  const core = { async execute() { return { status: 200, requestId: "bad", body: { data: null } }; } };
  const sync = { async reconcile() { throw new Error("should not call"); } };
  await assert.rejects(() => reconcileCanonicalTosAccess(core, sync, identity), /malformed/);
});
