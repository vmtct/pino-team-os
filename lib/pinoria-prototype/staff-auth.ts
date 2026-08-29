import { staffByUsername } from "@/lib/repositories/staff-access";

type PinoriaStaffIdentity = {
  id: string;
  name: string;
  username: string;
  email: string;
};

type CacheEntry = {
  staff: PinoriaStaffIdentity | null;
  expiresAt: number;
};

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function resolvePinoriaStaff(username: string): Promise<PinoriaStaffIdentity | null> {
  const key = username.trim();
  if (!key) return null;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.staff;

  const staff = await staffByUsername(key);
  const resolved = staff ? { id: staff.id, name: staff.name, username: key, email: staff.email.trim().toLowerCase() } : null;
  cache.set(key, { staff: resolved, expiresAt: now + CACHE_MS });
  return resolved;
}
