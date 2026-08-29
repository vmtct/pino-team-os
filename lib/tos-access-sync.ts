import type { VerifiedBoIdentity } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";

export interface TosAccessSyncBinding {
  reconcile(input: { emails: string[] }): Promise<{ state: string; emailCount: number; policyId: string | null }>;
}

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
  const emails = users.flatMap((user) => {
    if (user.status !== "active") return [];
    if (typeof user.staffMemberId !== "string" || !activeStaffIds.has(user.staffMemberId)) return [];
    if (typeof user.email !== "string" || !user.email.trim()) return [];
    if (!Array.isArray(user.assignments) || user.assignments.length === 0) return [];
    const hasNonFounderRole = user.assignments.some((assignment) => {
      if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) return false;
      return (assignment as Record<string, unknown>).roleKey !== "founder";
    });
    return hasNonFounderRole ? [user.email.trim().toLowerCase()] : [];
  });
  const uniqueEmails = [...new Set(emails)].sort();
  return sync.reconcile({ emails: uniqueEmails });
}

function readDataArray<T>(body: unknown): T[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("canonical access response is malformed");
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) throw new Error("canonical access response is malformed");
  return data as T[];
}
