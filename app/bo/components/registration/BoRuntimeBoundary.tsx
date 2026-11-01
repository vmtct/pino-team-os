"use client";
import { createContext, useContext, useMemo } from "react";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { BoRegistrationWorkspace } from "./BoRegistrationWorkspace";
import { unifiedBoWorkspaceSource } from "../../architecture/bo-unified-workspace-source";
import { BoOperationalView } from "../../BoOperationalView";
import { BoSubscriptionsView } from "../../subscriptions/BoSubscriptionsView";
import dynamic from "next/dynamic";
import { BoAuthenticatedAccount } from "@/app/bo/shell/BoAuthenticatedAccount";
import { BoCenterSelectionProvider, useBoCenterSelection } from "./BoCenterSelection";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { boCenterWave1Href, isBoCenterReadWave1 } from "./BoCenterWave1";

const ParentTdd = dynamic(() => import("../../parents/ParentTdd").then(module => module.ParentTdd), { ssr: false });
const MissionsTdd = dynamic(() => import("../../missions/BoMissionsTdd").then(module => module.BoMissionsTdd), { ssr: false });
const RuntimeContext = createContext<Pick<BoShellContext, "displayName" | "email"> | null>(null);
export const useBoStagingUser = () => useContext(RuntimeContext);
export function BoRuntimeBoundary({ currentUser, children }: { currentUser: Pick<BoShellContext, "displayName" | "email">; children: React.ReactNode }) {
  return <RuntimeContext.Provider value={currentUser}>{children}<BoAuthenticatedAccount displayName={currentUser.displayName} email={currentUser.email} /></RuntimeContext.Provider>;
}
function CenterReadPending({ message, denied }: { message: string; denied: boolean }) {
  const menu = useContext(TddHostMenu);
  return <section aria-label="Chọn cơ sở cho module">{menu("center-scope-menu-btn")}
    <p role={denied ? "alert" : "status"}>{message}</p>
  </section>;
}

function CenterReadWorkspace({ moduleKey, options, currentUser }: {
  moduleKey: string;
  options: Record<string, string>;
  currentUser: Pick<BoShellContext, "displayName" | "email">;
}) {
  const center = useBoCenterSelection();
  const selected = center?.selected ?? "";
  const scopedOptions = useMemo(() => ({ ...options, centerId: selected }), [options, selected]);
  const scopedSource = useMemo(() => ({
    ...unifiedBoWorkspaceSource,
    routeForModule: (key: string) => {
      const base = unifiedBoWorkspaceSource.routeForModule?.(key) ?? "/bo?module=" + encodeURIComponent(key);
      // Preserve the authorized Center only on routes whose Core data adapter is enrolled.
      return boCenterWave1Href(base, key, selected, center?.centers.map(c => c.id) ?? []);
    },
  }), [selected, center?.centers]);
  const blocked = !center || center.loading || Boolean(center.error) || !selected;
  const message = center?.error || (center?.loading ? "Đang xác thực danh sách cơ sở…" : "Chọn trung tâm tại góc trên trái để xem dữ liệu.");
  return <BoRegistrationWorkspace currentUser={currentUser} source={scopedSource}
    moduleKey={moduleKey} options={scopedOptions}
    content={blocked ? <CenterReadPending message={message} denied={Boolean(center?.error)} /> : undefined} />;
}

export function BoRuntimeEntry({ moduleKey, options, parentTddPilot = false }: { moduleKey: string; options: Record<string, string>; parentTddPilot?: boolean }) {
  const currentUser = useContext(RuntimeContext);
  if (moduleKey === "missions") return <MissionsTdd />;
  if (!currentUser) return <BoOperationalView view="overview" />;
  const isParentPilot = moduleKey === "parents" && parentTddPilot;
  // Stage 1 of the shared BO context: Parent TDD plus legacy Visits and Timekeeping
  // whose Core adapters already enforce explicit centerId and verify response identity.
  if (isBoCenterReadWave1(moduleKey)) return <BoCenterSelectionProvider>
    <CenterReadWorkspace moduleKey={moduleKey} options={options} currentUser={currentUser} />
  </BoCenterSelectionProvider>;
  const workspace = <BoRegistrationWorkspace currentUser={currentUser} source={unifiedBoWorkspaceSource} moduleKey={moduleKey} options={options}
    content={moduleKey === "subscriptions" ? <BoSubscriptionsView embedded /> :
      moduleKey === "parents" && parentTddPilot ? <ParentTdd /> : undefined} />;
  return isParentPilot ? <BoCenterSelectionProvider>{workspace}</BoCenterSelectionProvider> : workspace;
}
