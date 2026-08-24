export type PinoriaControllerLease = {
  surfaceId: string;
  staffId: string;
  staffName: string;
  clientId: string;
  acquiredAt: number;
  renewedAt: number;
  expiresAt: number;
};

type ControllerLeaseStore = {
  leases: Record<string, PinoriaControllerLease>;
};

type StaffIdentity = { id: string; name: string };

const LEASE_MS = 15_000;
const globalWithLeaseStore = globalThis as typeof globalThis & {
  __pinoriaPrototypeControllerLeases?: ControllerLeaseStore;
};
const store = globalWithLeaseStore.__pinoriaPrototypeControllerLeases ?? { leases: {} };
globalWithLeaseStore.__pinoriaPrototypeControllerLeases = store;

function activeLease(surfaceId: string, now = Date.now()) {
  const lease = store.leases[surfaceId];
  if (!lease) return null;
  if (lease.expiresAt <= now) {
    delete store.leases[surfaceId];
    return null;
  }
  return lease;
}

export function controllerLeaseSnapshot(surfaceId: string, now = Date.now()) {
  const lease = activeLease(surfaceId, now);
  return lease ? { ...lease } : null;
}

export function acquireControllerLease(
  surfaceId: string,
  staff: StaffIdentity,
  clientId: string,
  now = Date.now(),
) {
  const current = activeLease(surfaceId, now);
  if (current && (current.staffId !== staff.id || current.clientId !== clientId)) {
    return { ok: false as const, lease: { ...current } };
  }

  const lease: PinoriaControllerLease = current
    ? { ...current, staffName: staff.name, renewedAt: now, expiresAt: now + LEASE_MS }
    : {
        surfaceId,
        staffId: staff.id,
        staffName: staff.name,
        clientId,
        acquiredAt: now,
        renewedAt: now,
        expiresAt: now + LEASE_MS,
      };
  store.leases[surfaceId] = lease;
  return { ok: true as const, lease: { ...lease } };
}

export function renewControllerLease(
  surfaceId: string,
  staff: StaffIdentity,
  clientId: string,
  now = Date.now(),
) {
  const current = activeLease(surfaceId, now);
  if (!current || current.staffId !== staff.id || current.clientId !== clientId) {
    return { ok: false as const, lease: current ? { ...current } : null };
  }
  current.staffName = staff.name;
  current.renewedAt = now;
  current.expiresAt = now + LEASE_MS;
  return { ok: true as const, lease: { ...current } };
}

export function releaseControllerLease(
  surfaceId: string,
  staff: StaffIdentity,
  clientId: string,
  now = Date.now(),
) {
  const current = activeLease(surfaceId, now);
  if (!current) return { ok: true as const, lease: null };
  if (current.staffId !== staff.id || current.clientId !== clientId) {
    return { ok: false as const, lease: { ...current } };
  }
  delete store.leases[surfaceId];
  return { ok: true as const, lease: null };
}

export function isControllerLeaseOwner(
  surfaceId: string,
  staffId: string,
  clientId: string,
  now = Date.now(),
) {
  const lease = activeLease(surfaceId, now);
  return !!lease && lease.staffId === staffId && lease.clientId === clientId;
}
