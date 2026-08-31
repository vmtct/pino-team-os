import type { VerifiedBoIdentity } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";

export interface TosAccessSyncBinding {
  reconcile(input: { emails: string[] }): Promise<{ state: string; emailCount: number; policyId: string | null }>;
}

type AccessAssignment = {
  roleStatus?: unknown;
  tosApplicable?: unknown;
  scopeType?: unknown;
  scopeId?: unknown;
  effectiveFrom?: unknown;
  effectiveUntil?: unknown;
};

type AccessUser = {
  staffMemberId?: unknown;
  status?: unknown;
  email?: unknown;
  assignments?: unknown;
};

type StaffRecord = { id?: unknown; status?: unknown };

export async function reconcileCanonicalTosAccess(
  core: BoAccessCoreBinding,
  sync: TosAccessSyncBinding,
  identity: VerifiedBoIdentity,
) {
  const [usersResult, staffResult] = await Promise.all([
    callBoAccessCore(core, { method: "GET", path: "access/users" }, identity),
    callBoAccessCore(core, { method: "GET", path: "workforce/staff-records" }, identity),
  ]);
  if (usersResult.status !== 200 || staffResult.status !== 200) throw new Error("canonical access state could not be read");
  const users = readDataArray<AccessUser>(usersResult.body);
  const staff = readDataArray<StaffRecord>(staffResult.body);
  const activeStaffIds = new Set(
    staff.filter((item) => item.status === "active" && typeof item.id === "string").map((item) => item.id as string),
  );
  const now = Date.now();
  const emails = users.flatMap((user) => {
    if (user.status !== "active") return [];
    if (typeof user.staffMemberId !== "string" || !activeStaffIds.has(user.staffMemberId)) return [];
    if (typeof user.email !== "string" || !user.email.trim()) return [];
    if (!Array.isArray(user.assignments)) return [];
    const hasEffectiveTosGrant = user.assignments.some((assignment) => assignmentAllowsTos(assignment, now));
    return hasEffectiveTosGrant ? [user.email.trim().toLowerCase()] : [];
  });
  const uniqueEmails = [...new Set(emails)].sort();
  return sync.reconcile({ emails: uniqueEmails });
}

function assignmentAllowsTos(value: unknown, now: number): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const assignment = value as AccessAssignment;
  if (assignment.roleStatus !== "active" || assignment.tosApplicable !== true) return false;
  const from = typeof assignment.effectiveFrom === "string" ? Date.parse(assignment.effectiveFrom) : NaN;
  if (!Number.isFinite(from) || from > now) return false;
  if (assignment.effectiveUntil !== null) {
    const until = typeof assignment.effectiveUntil === "string" ? Date.parse(assignment.effectiveUntil) : NaN;
    if (!Number.isFinite(until) || until <= now) return false;
  }
  if (assignment.scopeType === "GLOBAL") return assignment.scopeId === null;
  return (assignment.scopeType === "CENTER" || assignment.scopeType === "PATH" || assignment.scopeType === "RUNNING_CLASS")
    && typeof assignment.scopeId === "string";
}

function readDataArray<T>(body: unknown): T[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("canonical access response is malformed");
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) throw new Error("canonical access response is malformed");
  return data as T[];
}
