import type { Staff } from "@/lib/domain/staff";

export function canAccess(staff: Staff | null, ...allowed: string[]): boolean {
  if (!staff) return false;
  const access = staff.appAccess.trim().toLowerCase();
  return allowed.some((value) => access === value.trim().toLowerCase());
}

export function assertAccess(staff: Staff | null, ...allowed: string[]): asserts staff is Staff {
  if (!canAccess(staff, ...allowed)) {
    throw new Error("Forbidden");
  }
}
