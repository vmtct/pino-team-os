"use client";
import { useContext, useMemo } from "react";
import { BoRegistrationWorkspace } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { useBoStagingUser } from "@/app/bo/components/registration/BoRuntimeBoundary";
import { useBoCenterSelection } from "@/app/bo/components/registration/BoCenterSelection";
import { boCenterModuleScope, boScopedModuleHref } from "@/app/bo/components/registration/BoGlobalCenterPolicy";
import { TddHostMenu } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { BoModuleFactory, type BoModuleReadAdapter } from "./BoModuleFactory";
import { unifiedBoWorkspaceSource } from "./bo-unified-workspace-source";

function WorkforceCenterPending({ message, denied }: { message: string; denied: boolean }) {
  const menu = useContext(TddHostMenu);
  return <section aria-label="Chọn cơ sở cho Workforce">{menu("workforce-center-menu-btn")}
    <p role={denied ? "alert" : "status"}>{message}</p>
  </section>;
}
export function BoWorkforceRoute({ moduleKey, adapter }: { moduleKey: string; adapter: BoModuleReadAdapter }) {
  // Only BO_UI_ONLY staging supplies global BO context. Keep Production Factory unchanged.
  const currentUser = useBoStagingUser();
  const center = useBoCenterSelection();
  const selected = center?.selected ?? "";
  const options = useMemo(() => ({ centerId: selected }), [selected]);
  const authorizedIds = center?.centers.map(c => c.id) ?? [];
  const source = useMemo(() => ({
    ...unifiedBoWorkspaceSource,
    routeForModule: (key: string) => {
      const href = unifiedBoWorkspaceSource.routeForModule?.(key) ?? "/bo?module=" + encodeURIComponent(key);
      return boScopedModuleHref(href, key, selected, authorizedIds);
    },
  }), [selected, center?.centers]);
  if (currentUser && boCenterModuleScope(moduleKey) === "CENTER") {
    const blocked = !center || center.loading || Boolean(center.error) || !selected ||
      !authorizedIds.includes(selected);
    const message = center?.error || (center?.loading ? "Đang xác thực danh sách cơ sở…" :
      "Chọn trung tâm tại góc trên trái để xem dữ liệu Workforce.");
    return <BoRegistrationWorkspace currentUser={currentUser} source={source} moduleKey={moduleKey}
      options={options} content={blocked ? <WorkforceCenterPending message={message}
        denied={Boolean(center?.error)} /> : undefined} />;
  }
  if (currentUser) return <BoRegistrationWorkspace currentUser={currentUser} source={unifiedBoWorkspaceSource} moduleKey={moduleKey} />;
  return <BoModuleFactory moduleKey={moduleKey} adapter={adapter} />;
}
