"use client";
import { useEffect, useMemo, useState } from "react";
import { canOpenAfterschoolAccounts } from "../afterschool-accounts/accounts-nav-access";
import { canOpenPosts } from "../piner-posts/posts-nav-access";
import { canOpenGuests } from "../mytime-guests/nav-access";
import { usePathname, useSearchParams } from "next/navigation";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "../components/registration/BoRegistrationWorkspace";
import { boScopedModuleHref } from "../components/registration/BoGlobalCenterPolicy";
import { BoContentCenterBoundary, useBoCenterSelection } from "../components/registration/BoCenterSelection";
import { unifiedBoWorkspaceSource } from "../architecture/bo-unified-workspace-source";
import { boNavigation } from "../navigation";
import {openingEvidenceBoModule} from "@/lib/opening-evidence-host-contract";
import { nativePayrollModule } from "@/lib/bo-native-payroll-route";

// Keep Production's existing destinations and content dispatch. Staging-only
// adapters and aliases are not enabled by adopting the shared presentation.
const destinations = boNavigation.flatMap(group => group.items.flatMap(item => [
  ...(item.href && item.href !== "/bo/open-studio-passes" && item.href !== "/bo/piner-posts" && item.href !== "/bo/mytime-guests" && item.href !== "/bo/enrollments" ? [{ href: item.href, label: item.label, group: group.label }] : []),
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
  enrollments: { label: "Lịch học", group: "SCHOOL", fields: [] },
  "pinoria-wish-events": { label: "Wish Events", group: "Pinoria", fields: [] },
  "opening-evidence": { label: "Mở lớp & ca", group: "SCHOOL", fields: [] },
  "classroom-diaries": { label: "Nhật ký lớp học", group: "SCHOOL", fields: [] },
  "open-studio-passes": { label: "Pass Trạm Nghệ Thuật", group: "Open Studio", fields: [] },
  "payroll-daily": { label: "Bảng lương ngày", group: "WORKFORCE", fields: [] },
  "payroll-exceptions": { label: "Ngoại lệ & thêm giờ", group: "WORKFORCE", fields: [] },
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
  const centerId = staging && !center?.loading && !center?.error ? center?.selected ?? "" : "";
  const [accountsCenter, setAccountsCenter] = useState<string | null>(null);
  const [postsCenter, setPostsCenter] = useState<string | null>(null);
  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    void canOpenAfterschoolAccounts(centerId, controller.signal).then(allowed => {
      if (!controller.signal.aborted) setAccountsCenter(allowed ? centerId : null);
    });
    return () => {
      controller.abort();
      setAccountsCenter(null);
    };
  }, [centerId]);
  const showAccounts = Boolean(centerId && accountsCenter === centerId);
  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    void canOpenPosts(centerId, controller.signal).then(allowed => {
      if (!controller.signal.aborted) setPostsCenter(allowed ? centerId : null);
    });
    return () => { controller.abort(); setPostsCenter(null); };
  }, [centerId]);
  const showPosts = Boolean(centerId && postsCenter === centerId);
  const [guestsCenter,setGuestsCenter]=useState<string|null>(null);
  useEffect(()=>{
    if(!centerId)return;
    const ctl=new AbortController();
    void canOpenGuests(centerId,ctl.signal).then(allowed=>{if(!ctl.signal.aborted)setGuestsCenter(allowed?centerId:null);});
    return ()=>{ctl.abort();setGuestsCenter(null);};
  },[centerId]);
  const showGuests=Boolean(centerId&&guestsCenter===centerId);
  const scopedSource = useMemo<BoWorkspaceSource>(() => ({
    ...stagingSource,
    modules: {
      ...stagingSource.modules,
      ...(showAccounts ? {"afterschool-accounts": { label: "Tài khoản", group: "SCHOOL", fields: [] }} : {}),
      ...(showPosts ? {"piner-posts": { label: "Posts", group: "Piner App", fields: [] }} : {}),
      ...(showGuests ? {"mytime-guests": {label:"Khách MyTime",group:"Operations",fields:[]}} : {}),
    },
    routeForModule: key => key === "afterschool-accounts" && showAccounts
      ? "/bo/afterschool-accounts?" + new URLSearchParams({ centerId })
      : key === "piner-posts" && showPosts ? "/bo/piner-posts?" + new URLSearchParams({ centerId })
      : key==="mytime-guests"&&showGuests ? "/bo/mytime-guests?"+new URLSearchParams({centerId})
      : key === "enrollments" && centerId ? "/bo/enrollments?" + new URLSearchParams({centerId})
      : boScopedModuleHref(stagingSource.routeForModule!(key), key,
        center?.selected ?? "", center?.centers.map(item => item.id) ?? []),
  }), [center?.selected, center?.centers, centerId, showAccounts, showPosts, showGuests]);
  const productionDestination = destinations.find(item => item.href === pathname)
    ?? destinations.filter(item => item.href !== "/bo" && pathname.startsWith(item.href + "/"))
      .sort((left, right) => right.href.length - left.href.length)[0];
  const productionKey = destinationKey(productionDestination?.href ?? "/bo");
  const stagingKey = pathname === "/bo" || pathname === "/bo/"
    ? query.get("module") ?? "students"
    : nativePayrollModule(pathname) ?? openingEvidenceBoModule(pathname) ?? pathname.slice("/bo/".length);
  return <BoRegistrationWorkspace shellOnly currentUser={currentUser}
    moduleKey={staging ? stagingKey : productionKey}
    source={staging ? scopedSource : productionSource}
    content={<BoContentCenterBoundary staging={staging}>{children}</BoContentCenterBoundary>} />;
}
