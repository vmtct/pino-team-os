import { defineBoModuleRegistry, type BoModuleContract } from "./contract";

/**
 * MANAGED SOURCE REGISTRY — PAP-926.
 * Add new entities through `npm run bo:module:new -- <slug> <route>` then
 * implement the generated domain adapter. The verifier reads these literal
 * declarations WITHOUT executing code. Historic 2026-10-22 routes remain in
 * a separately frozen baseline until migrated by PAP-878.
 */
export const boModuleRegistry: readonly BoModuleContract[] = defineBoModuleRegistry([
  // BO_NEW_MODULE_REGISTRATIONS — GENERATOR APPENDS ABOVE THIS LINE.
]);

export function requireBoModule(key: string) {
  const entry=boModuleRegistry.find(item=>item.key===key);
  if (!entry) throw new Error(`Unregistered BO module denied: ${key}`);
  return entry;
}

export function requireBoModuleForRoute(route: string) {
  const entry=boModuleRegistry.find(item=>item.href===route);
  if (!entry) throw new Error(`Unregistered BO route denied: ${route}`);
  return entry;
}
