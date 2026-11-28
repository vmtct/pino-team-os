export function showStudentsWhileCatalogLoads(
  staging: boolean,
  centerAuthorized: boolean,
  directory: "loading" | "error" | "ready",
): boolean {
  return staging && centerAuthorized && directory === "ready";
}
