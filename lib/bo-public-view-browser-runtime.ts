/** Explicit BO browser integration boundary: no token access or inferred permissions. */
import { BoPublicViewCoreClient } from "./bo-public-view-core-client";
import { BoPublicViewRuntime } from "./bo-public-view-runtime";
import type { BoViewRole } from "./bo-public-view-state";

export type BoBrowserViewModuleContract = {
  moduleKey: string;
  allowedFields: readonly string[];
  /** Provided by an independently authorized BO session/adapter, never guessed here. */
  role: BoViewRole;
};
export function createBoPublicViewBrowserRuntime(contract: BoBrowserViewModuleContract): BoPublicViewRuntime {
  if (typeof window === "undefined") throw new Error("Shared Views require a BO browser context");
  const baseUrl=window.location.origin;
  const client=new BoPublicViewCoreClient({
    baseUrl,moduleKey:contract.moduleKey,allowedFields:contract.allowedFields,
    role:contract.role,authMode:"team_cookie",
  });
  return new BoPublicViewRuntime({
    moduleKey:contract.moduleKey,allowedFields:contract.allowedFields,
    role:contract.role,client,
  });
}