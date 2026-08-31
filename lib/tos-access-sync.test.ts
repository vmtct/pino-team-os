import test from "node:test";
import assert from "node:assert/strict";
import { reconcileCanonicalTosAccess } from "./tos-access-sync";
import type { VerifiedBoIdentity } from "./bo-auth";

const identity: VerifiedBoIdentity = {
  provider: "cloudflare_access", subject: "founder", email: "founder@example.com",
  issuer: "https://team.cloudflareaccess.com", audience: ["bo"], expiresAt: Math.floor(Date.now() / 1000) + 300,
};

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    roleKey: "mentor", roleStatus: "active", tosApplicable: true, scopeType: "GLOBAL", scopeId: null,
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(), effectiveUntil: null, ...overrides,
  };
}

test("reconciles only current canonical TOS-entitled active staff", async () => {
  const calls: string[] = [];
  const core = { async execute(request: { path: string }) {
    calls.push(request.path);
    if (request.path === "workforce/staff-records") return { status: 200, requestId: "staff", body: { data: [
      { id: "staff-a", status: "active" }, { id: "staff-b", status: "inactive" }, { id: "staff-c", status: "active" },
      { id: "staff-d", status: "active" }, { id: "staff-e", status: "active" }, { id: "staff-f", status: "active" },
      { id: "staff-g", status: "active" }, { id: "staff-h", status: "active" },
    ] } };
    return { status: 200, requestId: "users", body: { data: [
      { staffMemberId: "staff-a", status: "active", email: " A@Example.com ", assignments: [assignment()] },
      { staffMemberId: "staff-b", status: "active", email: "b@example.com", assignments: [assignment()] },
      { staffMemberId: "staff-c", status: "suspended", email: "c@example.com", assignments: [assignment()] },
      { staffMemberId: "staff-d", status: "active", email: "d@example.com", assignments: [assignment({ tosApplicable: false })] },
      { staffMemberId: "staff-e", status: "active", email: "e@example.com", assignments: [assignment({ effectiveFrom: new Date(Date.now() + 60_000).toISOString() })] },
      { staffMemberId: "staff-f", status: "active", email: "founder@example.com", assignments: [assignment({ roleKey: "founder", roleType: "system" })] },
      { staffMemberId: "staff-g", status: "active", email: "g@example.com", assignments: [assignment({ roleStatus: "archived" })] },
      { staffMemberId: "staff-h", status: "active", email: "h@example.com", assignments: [assignment({ effectiveUntil: new Date(Date.now() - 1_000).toISOString() })] },
    ] } };
  } };
  let emails: string[] = [];
  const sync = { async reconcile(input: { emails: string[] }) { emails = input.emails; return { state: "updated", emailCount: emails.length, policyId: "policy" }; } };
  const result = await reconcileCanonicalTosAccess(core, sync, identity);
  assert.deepEqual(calls.sort(), ["access/users", "workforce/staff-records"]);
  assert.deepEqual(emails, ["a@example.com", "founder@example.com"]);
  assert.equal(result.emailCount, 2);
});

test("fails closed when canonical projections are malformed", async () => {
  const core = { async execute() { return { status: 200, requestId: "bad", body: { data: null } }; } };
  const sync = { async reconcile() { throw new Error("should not call"); } };
  await assert.rejects(() => reconcileCanonicalTosAccess(core, sync, identity), /malformed/);
});
