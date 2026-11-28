"use client";
import { createContext, useContext, useMemo } from "react";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "./BoRegistrationWorkspace";
import { StaffDirectoryWorkspace } from "../../workforce/staffs/StaffDirectoryWorkspace";
import { StaffRegistrationSection } from "../../staff/StaffRegistrationSection";
import { unifiedBoWorkspaceSource } from "../../architecture/bo-unified-workspace-source";
import { BoOperationalView } from "../../BoOperationalView";
import dynamic from "next/dynamic";
import { BoAuthenticatedAccount } from "@/app/bo/shell/BoAuthenticatedAccount";
import { BoCenterSelectionProvider, useBoCenterSelection } from "./BoCenterSelection";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { boCenterModuleScope, boScopedModuleHref, scopedBoReadFetcher } from "./BoGlobalCenterPolicy";

// PAP-1814 / SCH-PARENTS-GUARDIANS: Parent route now uses native PINO BO DSA.
const ParentDirectoryDsa = dynamic(() => import("../../parents/ParentDirectoryDsa").then(module => module.ParentDirectoryDsa), { ssr: false });
// PAP-1334 / PAP-1491: new Center-owned Subscription Table/Drawer/Detail,
// not the retired legacy global Learner/Sale/Enrollment workspace.
const SubscriptionDirectoryDsa = dynamic(() => import("../../subscriptions/SubscriptionDirectoryDsa").then(module => module.SubscriptionDirectoryDsa), { ssr: false });
const MissionsTdd = dynamic(() => import("../../missions/BoMissionsTdd").then(module => module.BoMissionsTdd), { ssr: false });
const RuntimeContext = createContext<Pick<BoShellContext, "displayName" | "email"> | null>(null);
// PAP-1545 / PAP-1316: Access audit is a Core GLOBAL collection. Keep the
// master workspace Center for navigation but never imply that it filters Audits.
// Immutable audit events have no generic Create/Edit writer.
const globalAuditWorkspaceSource: BoWorkspaceSource = {
  ...unifiedBoWorkspaceSource,
  isModuleReadOnly: key => key === "audits" || unifiedBoWorkspaceSource.isModuleReadOnly?.(key) === true,
  scopeLabel: (key, options) => key === "audits"
    ? "Toàn hệ thống — nhật ký truy cập không lọc theo cơ sở đã chọn."
    : unifiedBoWorkspaceSource.scopeLabel(key, options),
};
export const useBoStagingUser = () => useContext(RuntimeContext);
export function BoRuntimeBoundary({ currentUser, children, staging = true }: { currentUser: Pick<BoShellContext, "displayName" | "email">; children: React.ReactNode; staging?: boolean }) {
  return <RuntimeContext.Provider value={staging ? currentUser : null}><BoCenterSelectionProvider>{children}</BoCenterSelectionProvider><BoAuthenticatedAccount displayName={currentUser.displayName} email={currentUser.email} profileHref={staging ? undefined : "/bo/profile"} /></RuntimeContext.Provider>;
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
    load: (key: string, fetcher: typeof fetch, requestedOptions: Record<string, string>) =>
      unifiedBoWorkspaceSource.load(key, scopedBoReadFetcher(key, fetcher, selected), requestedOptions),
    routeForModule: (key: string) => {
      const base = unifiedBoWorkspaceSource.routeForModule?.(key) ?? "/bo?module=" + encodeURIComponent(key);
      // Preserve the authorized Center only on routes whose Core data adapter is enrolled.
      return boScopedModuleHref(base, key, selected, center?.centers.map(c => c.id) ?? []);
    },
  }), [selected, center?.centers]);
  const blocked = !center || center.loading || Boolean(center.error) || !selected;
  const message = center?.error || (center?.loading ? "Đang xác thực danh sách cơ sở…" : "Chọn trung tâm tại góc trên trái để xem dữ liệu.");
  return <BoRegistrationWorkspace currentUser={currentUser} source={scopedSource}
    moduleKey={moduleKey} options={scopedOptions}
    content={blocked ? <CenterReadPending message={message} denied={Boolean(center?.error)} /> : undefined} />;
}

/** PAP-2004 / PAP-220: canonical Staffs registration tab uses the Center review capability; unrelated directory stays fail-closed. */
function BoStaffsEntry({ currentUser, options }: {
  currentUser: Pick<BoShellContext, "displayName" | "email">;
  options: Record<string, string>;
}) {
  const center = useBoCenterSelection();
  const source = useMemo<BoWorkspaceSource>(() => ({
    ...unifiedBoWorkspaceSource,
    isModuleReadOnly: (key) => key === "staffs" || unifiedBoWorkspaceSource.isModuleReadOnly?.(key) === true,
    async load(key, fetcher, requestedOptions) {
      if (key === "staffs") {
        // PAP-1544 / PAP-1316: legacy reader is unscoped. Preserve fail-closed.
        throw Error("Danh s\u00e1ch nh\u00e2n s\u1ef1 theo c\u01a1 s\u1edf t\u1ea1m th\u1eddi ch\u01b0a kh\u1ea3 d\u1ee5ng.");
      }
      return unifiedBoWorkspaceSource.load(key, fetcher, requestedOptions);
    },
  }), []);
  return <StaffDirectoryWorkspace currentUser={currentUser} options={options} centerId={center?.selected ?? ""} source={source} registration={<StaffRegistrationSection embedded />} />;
}

export function BoRuntimeEntry({ moduleKey, options }: { moduleKey: string; options: Record<string, string> }) {
  const currentUser = useContext(RuntimeContext);
  if (moduleKey === "missions") return <MissionsTdd />;
  if (!currentUser) return <BoOperationalView view="overview" />;
  // PAP-1814 / Epic PAP-1384: native DSA Parent owns its Core-attested Center scope.
  // Never fall through to the unscoped legacy Directory.
  if (moduleKey === "parents") return <BoRegistrationWorkspace currentUser={currentUser}
    source={unifiedBoWorkspaceSource} moduleKey="parents" options={options}
    content={<ParentDirectoryDsa />} />;
  if (moduleKey === "staffs") return <BoStaffsEntry currentUser={currentUser} options={options} />;
  if (moduleKey === "audits") return <BoRegistrationWorkspace currentUser={currentUser}
    source={globalAuditWorkspaceSource} moduleKey="audits" options={options} />;
  // PAP-1334 / PAP-1491: real Center-scoped native read-only Subscription
  // Table/Drawer/Detail. Do NOT mount old unscoped Learners/Sale/Renew/Enrollment
  // component: PAP-1350 must first land an independently authorized Center writer.
  if (moduleKey === "subscriptions") return <BoRegistrationWorkspace currentUser={currentUser}
    source={unifiedBoWorkspaceSource} moduleKey="subscriptions" options={options}
    content={<SubscriptionDirectoryDsa />} />;
  // Stage 1 of the shared BO context: Parent TDD plus legacy Visits and Timekeeping
  // whose Core adapters already enforce explicit centerId and verify response identity.
  if (boCenterModuleScope(moduleKey) === "CENTER") return <CenterReadWorkspace moduleKey={moduleKey} options={options} currentUser={currentUser} />;
  return <BoRegistrationWorkspace currentUser={currentUser} source={unifiedBoWorkspaceSource} moduleKey={moduleKey} options={options} />;
}
