import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { boNavigation } from "../app/bo/navigation";
import { TOS_HOME_FOOTER, TOS_SHIFT_FOOTER, TOS_CLASSROOM_FOOTER, TOS_TASKS_FOOTER, TOS_PINORIA_FOOTER, TOS_OPEN_STUDIO_FOOTER, TOS_TV_FOOTER } from "../app/components/tos-shell/navigation";
import { BO_HOSTNAME, TOS_HOSTNAME, decideHostBoundary, requiresBoStaffPasswordSession } from "./host-boundary";

type NavItem = { href?: string; children?: NavItem[] };
export function collectNavHrefs(items: NavItem[]): string[] {
  const hrefs: string[] = [];
  const walk = (item: NavItem) => {
    if (item.href) hrefs.push(item.href);
    item.children?.forEach(walk);
  };
  items.forEach(walk);
  return [...new Set(hrefs)];
}

export function checkPageContract(root: string, hostname: string, href: string): string[] {
  const errors: string[] = [];
  if (!href.startsWith("/") || href.includes("?") || href.includes("#") || href.includes("..")) return ["invalid_navigation_href"];
  const target = href === "/" ? "app" : join("app", ...href.slice(1).split("/"));
  if (!["page.tsx", "page.ts", "page.jsx", "page.js"].some((name) => existsSync(join(root, target, name)))) errors.push("missing_page");
  if (decideHostBoundary(hostname, href).action !== "next") errors.push("host_denied");
  if (hostname === BO_HOSTNAME && !requiresBoStaffPasswordSession(hostname, href)) errors.push("bo_auth_not_required");
  if (hostname === TOS_HOSTNAME && href.startsWith("/bo")) errors.push("tos_bo_exposed");
  return errors;
}

const coreApis: ReadonlyArray<{path: string; handler: string; marker: string}> = [
  { path: "/api/bo/learning/missions", handler: "lib/bo-read-handler.ts", marker: 'path === "learning/missions"' },
  { path: "/api/bo/pinoria/worlds/instances", handler: "lib/bo-read-handler.ts", marker: 'path === "pinoria/worlds/instances"' },
  { path: "/api/bo/student-visits", handler: "lib/bo-read-handler.ts", marker: 'path === "student-visits"' },
  { path: "/api/bo/workforce/payroll/periods", handler: "lib/bo-payroll-period-handler.ts", marker: 'workforce/payroll/periods' },
  { path: "/api/bo/workforce/payroll/extra-time/reviews", handler: "lib/bo-payroll-extra-review-handler.ts", marker: 'workforce/payroll/extra-time/reviews' },
  { path: "/api/bo/pinoria/tv-config/policy/head", handler: "lib/bo-read-handler.ts", marker: 'pinoria/tv-config/policy/head' },
];

export function checkApiContract(root: string, path: string, handler: string, marker: string): string[] {
  const errors: string[] = [];
  if (!existsSync(join(root, "app/api/bo/[...path]/route.ts"))) errors.push("missing_facade");
  if (decideHostBoundary(BO_HOSTNAME, path).action !== "next") errors.push("bo_host_denied");
  if (decideHostBoundary(TOS_HOSTNAME, path).action !== "not_found") errors.push("tos_api_exposed");
  const filename = join(root, handler);
  if (!existsSync(filename) || !readFileSync(filename, "utf8").includes(marker)) errors.push("missing_dispatch_target");
  return errors;
}

export function verifyReleaseRouteContracts(root: string): string[] {
  const problems: string[] = [];
  const boHrefs = collectNavHrefs(boNavigation.flatMap((g) => g.items as NavItem[]));
  if (boHrefs.length < 20) problems.push("suspiciously_empty_bo_navigation");
  for (const href of boHrefs) for (const issue of checkPageContract(root, BO_HOSTNAME, href)) problems.push("bo_nav:"+href+":"+issue);
  const tosAppHrefs = [...new Set([...collectNavHrefs([...TOS_HOME_FOOTER, ...TOS_SHIFT_FOOTER, ...TOS_CLASSROOM_FOOTER, ...TOS_TASKS_FOOTER, ...TOS_PINORIA_FOOTER, ...TOS_OPEN_STUDIO_FOOTER, ...TOS_TV_FOOTER]), "/training", "/check-in"])];
  for (const href of tosAppHrefs) for (const issue of checkPageContract(root, TOS_HOSTNAME, href)) problems.push("tos_nav:"+href+":"+issue);
  for (const api of coreApis) for (const issue of checkApiContract(root, api.path, api.handler, api.marker)) problems.push("bo_api:"+api.path+":"+issue);
  return problems;
}
