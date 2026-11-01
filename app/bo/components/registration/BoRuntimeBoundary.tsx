"use client";
import { createContext, useContext } from "react";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { BoRegistrationWorkspace } from "./BoRegistrationWorkspace";
import { unifiedBoWorkspaceSource } from "../../architecture/bo-unified-workspace-source";
import { BoOperationalView } from "../../BoOperationalView";
import { BoSubscriptionsView } from "../../subscriptions/BoSubscriptionsView";
import dynamic from "next/dynamic";
import { BoAuthenticatedAccount } from "@/app/bo/shell/BoAuthenticatedAccount";
import { BoCenterSelectionProvider } from "./BoCenterSelection";

const ParentTdd = dynamic(() => import("../../parents/ParentTdd").then(module => module.ParentTdd), { ssr: false });
const MissionsTdd = dynamic(() => import("../../missions/BoMissionsTdd").then(module => module.BoMissionsTdd), { ssr: false });
const RuntimeContext = createContext<Pick<BoShellContext, "displayName" | "email"> | null>(null);
export const useBoStagingUser = () => useContext(RuntimeContext);
export function BoRuntimeBoundary({ currentUser, children }: { currentUser: Pick<BoShellContext, "displayName" | "email">; children: React.ReactNode }) {
  return <RuntimeContext.Provider value={currentUser}>{children}<BoAuthenticatedAccount displayName={currentUser.displayName} email={currentUser.email} /></RuntimeContext.Provider>;
}
export function BoRuntimeEntry({ moduleKey, options, parentTddPilot = false }: { moduleKey: string; options: Record<string, string>; parentTddPilot?: boolean }) {
  const currentUser = useContext(RuntimeContext);
  if (moduleKey === "missions") return <MissionsTdd />;
  if (!currentUser) return <BoOperationalView view="overview" />;
  const isParentPilot = moduleKey === "parents" && parentTddPilot;
  const workspace = <BoRegistrationWorkspace currentUser={currentUser} source={unifiedBoWorkspaceSource} moduleKey={moduleKey} options={options}
    content={moduleKey === "subscriptions" ? <BoSubscriptionsView embedded /> :
      moduleKey === "parents" && parentTddPilot ? <ParentTdd /> : undefined} />;
  // Only this opt-in TDD module can change the Core-scoped Center from the shell.
  return isParentPilot ? <BoCenterSelectionProvider>{workspace}</BoCenterSelectionProvider> : workspace;
}
