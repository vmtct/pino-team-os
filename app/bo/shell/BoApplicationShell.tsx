"use client";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "../components/registration/BoRegistrationWorkspace";
import { boScopedModuleHref } from "../components/registration/BoGlobalCenterPolicy";
import { BoContentCenterBoundary, useBoCenterSelection } from "../components/registration/BoCenterSelection";
import { unifiedBoWorkspaceSource } from "../architecture/bo-unified-workspace-source";
import { boNavigation } from "../navigation";

// Keep Production's existing destinations and content dispatch. Staging-only
// adapters and aliases are not enabled by adopting the shared presentation.
const destinations = boNavigation.flatMap(group => group.items.flatMap(item => [
  ...(item.href && item.href !== "/bo/open-studio-passes" ? [{ href: item.href, label: item.label, group: group.label }] : []),
  ...(item.children ?? []).filter(child => child.href !== item.href).map(child => ({ ...child, group: group.label })),
]));
const destinationKey = (href: string) => href === "/bo" ? "overview" : href.slice("/bo/".length);
const productionSource: BoWorkspaceSource = {
  modules: Object.fromEntries(destinations.map(item => [destinationKey(item.href), { label: item.label, group: item.group, fields: [] }])),
  routeForModule: key => destinations.find(item => destinationKey(item.href) === key)?.href ?? "/bo",
  scopeLabel: () => "",
  load: async () => { throw Error("Application chrome cannot load module data"); },
};

// These existing admitted direct pages have their own content adapters. Register
// presentation destinations only; never call those adapters from the outer shell.
const directModules = {
  "classroom-diaries": { label: "Nhật ký lớp học", group: "SCHOOL", fields: [] },
  "open-studio-passes": { label: "Pass Trạm Nghệ Thuật", group: "Open Studio", fields: [] },
};
const stagingSource: BoWorkspaceSource = {
  ...unifiedBoWorkspaceSource,
  modules: { ...unifiedBoWorkspaceSource.modules, ...directModules },
  routeForModule: key => Object.hasOwn(directModules, key) ? "/bo/" + key : unifiedBoWorkspaceSource.routeForModule!(key),
};

/** One BO chrome owner for content-only and workspace-owning routes on both hosts. */
export function BoApplicationShell({ currentUser, staging, children }: {
  currentUser: Pick<BoShellContext, "displayName" | "email">;
  staging: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const center = useBoCenterSelection();
  const scopedSource = useMemo<BoWorkspaceSource>(() => ({
    ...stagingSource,
    routeForModule: key => boScopedModuleHref(stagingSource.routeForModule!(key), key,
      center?.selected ?? "", center?.centers.map(item => item.id) ?? []),
  }), [center?.selected, center?.centers]);
  const productionDestination = destinations.find(item => item.href === pathname)
    ?? destinations.filter(item => item.href !== "/bo" && pathname.startsWith(item.href + "/"))
      .sort((left, right) => right.href.length - left.href.length)[0];
  const productionKey = destinationKey(productionDestination?.href ?? "/bo");
  const stagingKey = pathname === "/bo" || pathname === "/bo/"
    ? query.get("module") ?? "students"
    : pathname.slice("/bo/".length);
  return <BoRegistrationWorkspace shellOnly currentUser={currentUser}
    moduleKey={staging ? stagingKey : productionKey}
    source={staging ? scopedSource : productionSource}
    content={<BoContentCenterBoundary staging={staging}>{children}</BoContentCenterBoundary>} />;
}
