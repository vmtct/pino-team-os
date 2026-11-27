/**
 * PAP-2342 / PLT-M1-DELIVERY. Synthetic review entitlement ONLY.
 * Invoke solely in the trusted server boundary after the existing Core
 * private session RPC has validated the current authenticated request.
 * Never pass a browser DTO, cookie claims, request headers or client identity.
 * The result is not a member-data permission or a session authenticator.
 */
type Program = "house" | "mytime";
type Input = {
  environment?: string;
  enabled?: string;
  reviewerAllowlist?: string;
  program: Program;
  privateSessionReply: unknown;
  now: number;
};
type Decision = { allowed: false } | { allowed: true; program: Program };
const denied: Decision = { allowed: false };
const canonicalId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && canonicalId.test(v);
const isProgram = (v: unknown): v is Program => v === "house" || v === "mytime";
export function decidePinerSyntheticReviewer(input: Input): Decision {
  if (typeof window !== "undefined") throw new Error("Synthetic reviewer proof is server-only");
  if (input.environment !== "staging" || input.enabled !== "true" ||
      !isProgram(input.program) || !Number.isFinite(input.now) ||
      typeof input.reviewerAllowlist !== "string" || input.reviewerAllowlist.length > 32768) return denied;
  const envelope = input.privateSessionReply;
  if (!isRecord(envelope) || !isRecord(envelope.data)) return denied;
  const { principalType, parent, session } = envelope.data;
  if (principalType !== "PARENT_USER" || !isRecord(parent) || !isId(parent.id) ||
      !isRecord(session) || !isId(session.id) || typeof session.issuedAt !== "string" ||
      typeof session.expiresAt !== "string") return denied;
  const issued = Date.parse(session.issuedAt), expires = Date.parse(session.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > input.now ||
      expires <= input.now || expires > issued + 30 * 86400000) return denied;
  let entries: unknown;
  try { entries = JSON.parse(input.reviewerAllowlist); } catch { return denied; }
  if (!Array.isArray(entries) || entries.length > 100) return denied;
  const seen = new Set<string>();
  let allowed = false;
  for (const entry of entries) {
    if (!isRecord(entry) || Object.keys(entry).length !== 2 || !isId(entry.parentUserId) ||
        seen.has(entry.parentUserId) || !Array.isArray(entry.programs) ||
        entry.programs.length < 1 || entry.programs.length > 2 ||
        !entry.programs.every(isProgram) ||
        new Set(entry.programs).size !== entry.programs.length) return denied;
    seen.add(entry.parentUserId);
    if (entry.parentUserId === parent.id && entry.programs.includes(input.program)) allowed = true;
  }
  return allowed ? { allowed: true, program: input.program } : denied;
}
