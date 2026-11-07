/** Staff Access role/scopes are independent of Staff's operational employment role. */
export type AccessScopeType = "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
export interface AccessScopeCatalog {
  centers: ReadonlyArray<{ id: string }>;
  paths: ReadonlyArray<{ id: string }>;
  classes: ReadonlyArray<{ id: string }>;
}

export function staffAccessScopeValid(scopeType: AccessScopeType, scopeId: string, catalog: AccessScopeCatalog): boolean {
  if (scopeType === "GLOBAL") return !scopeId;
  if (!scopeId) return false;
  const list = scopeType === "CENTER" ? catalog.centers : scopeType === "PATH" ? catalog.paths : catalog.classes;
  return list.some((item) => item.id === scopeId);
}

/** Core remains authoritative; BO also forbids a casual Founder-role revoke at action time. */
export function staffAccessCanRevoke(assignment: { roleKey: string } | null | undefined): boolean {
  return Boolean(assignment && assignment.roleKey !== "founder");
}
