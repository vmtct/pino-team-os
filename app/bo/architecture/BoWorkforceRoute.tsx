"use client";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { BoModuleFactory, type BoModuleReadAdapter } from "./BoModuleFactory";
import { unifiedBoWorkspaceSource } from "./bo-unified-workspace-source";
export function BoWorkforceRoute({ moduleKey, adapter }: { moduleKey: string; adapter: BoModuleReadAdapter }) {
  // Only BO_UI_ONLY staging supplies the unified runtime context.
  // Keep ordinary production's old Factory + BoShell unchanged.
  const currentUser = useBoStagingUser();
  if (currentUser) return <BoRegistrationWorkspace currentUser={currentUser} source={unifiedBoWorkspaceSource} moduleKey={moduleKey} />;
  return <BoModuleFactory moduleKey={moduleKey} adapter={adapter} />;
}
