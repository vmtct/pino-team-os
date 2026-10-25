"use client";
import { createContext, useContext } from "react";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { BoRegistrationWorkspace } from "./BoRegistrationWorkspace";
import { BoOperationalView } from "../../BoOperationalView";
const RuntimeContext = createContext<Pick<BoShellContext, "displayName"> | null>(null);
export function BoRuntimeBoundary({ currentUser, children }: { currentUser: Pick<BoShellContext, "displayName">; children: React.ReactNode }) { return <RuntimeContext.Provider value={currentUser}>{children}</RuntimeContext.Provider>; }
export function BoRuntimeEntry({ moduleKey, options }: { moduleKey: string; options: Record<string, string> }) {
  const currentUser = useContext(RuntimeContext);
  return currentUser ? <BoRegistrationWorkspace currentUser={currentUser} moduleKey={moduleKey} options={options} /> : <BoOperationalView view="overview" />;
}
