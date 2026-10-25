import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "./bo-shell-gate";
import { boNavigation } from "../app/bo/navigation";

export interface BoSkeletonEnv extends BoShellGateEnv {
  APP_ENV?: string;
  BO_UI_ONLY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export const BO_SKELETON_HOST = "pino-team-os-staging.minhtri-van42.workers.dev";
export const BO_AUTHORITY_PREFIX = "/bo-authority-source/";
export const BO_AUTHORITY_ASSETS = new Set([
  "playground.html", "styles.css", "playground.js", "playground.css",
  "playground-v22.css", "playground-v23.css", "full-detail-v24.css", "full-detail-v25.css",
]);
export function boSkeletonEnabled(env: Pick<BoSkeletonEnv, "APP_ENV" | "BO_UI_ONLY">, host: string) {
  return env.APP_ENV === "staging" && env.BO_UI_ONLY === "enabled" && host.toLowerCase() === BO_SKELETON_HOST;
}

// The immutable source remains untouched on disk. The only runtime seam supplies
// Students data and prevents edits; it introduces no style declarations/classes.
export function injectStudentsBridge(source: string, bridge: string): string {
  const bootstrap = "renderNav();renderStrip();renderRules();renderTable();bind();";
  if (source.split(bootstrap).length !== 2) throw new Error("Authority bootstrap drift");
  const grid = 'return categories.map(([title,keys])=>';
  if (source.split(grid).length !== 2) throw new Error("Authority property grid drift");
  const navigation = /const groups=\[[\s\S]*?\];\r?\n let visible=/;
  if (!navigation.test(source)) throw new Error("Authority navigation drift");
  // Navigation is data from the existing BO IA, rendered ONLY by registration's
  // original navigation renderer. No other module's markup/style is imported.
  const groups: [string, { label: string; href: string; icon: string; current?: boolean }[]][] = [
    ["HỒ SƠ", [{ label: "Hồ sơ đăng ký", href: "./playground.html", icon: "▤", current: true }]],
    ...boNavigation.map(group => [group.label.toLocaleUpperCase("vi"), group.items.filter(item => item.href).map(item => {
      const href = item.href!;
      const key = href === "/bo/learners" ? "students" : href === "/bo/running-classes" ? "classes" : href.replace(/^\/bo\/?/, "") || "today";
      return { label: item.label, href: "./playground.html?module=" + encodeURIComponent(key), icon: "▤" };
    })] as [string, { label: string; href: string; icon: string }[]]),
  ];
  return source.replace(navigation, 'const groups=skeletonNavigation;\n let visible=')
    .replace(grid, 'if(skeletonModule==="students")categories.splice(0,categories.length,["Thông tin chính",FIELDS.map(f=>f.key)]);\n '+grid)
    .replace(bootstrap, 'const skeletonNavigation='+JSON.stringify(groups)+';\n'+bridge + "\n" + bootstrap);
}

export async function serveBoSkeleton(request: Request, env: BoSkeletonEnv, asset: string): Promise<Response> {
  const url = new URL(request.url);
  const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
  if (!boSkeletonEnabled(env, url.hostname) || !BO_AUTHORITY_ASSETS.has(asset)) return new Response("Not Found", { status: 404, headers });
  try { await authorizeBoShell(request.headers, env); }
  catch (error) {
    if (error instanceof BoShellGateError) {
      if (asset.endsWith(".html") && error.status === 401) return new Response(null, { status: 307, headers: { ...headers, location: "/staff-login" } });
      if (asset.endsWith(".html") && error.code === "ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED") return new Response(null, { status: 307, headers: { ...headers, location: "/staff-password/change" } });
      return new Response("BO access denied", { status: error.status, headers });
    }
    return new Response("BO authorization unavailable", { status: 503, headers });
  }
  const read = (file: string) => env.ASSETS.fetch(new Request(new URL(BO_AUTHORITY_PREFIX + file, url.origin)));
  const response = await read(asset);
  if (!response.ok) return new Response("Authority asset unavailable", { status: 503, headers });
  if (asset === "playground.js") {
    const bridge = await read("skeleton-bridge.js");
    if (!bridge.ok) return new Response("Readonly bridge unavailable", { status: 503, headers });
    try { return new Response(injectStudentsBridge(await response.text(), await bridge.text()), { headers: { ...headers, "content-type": "text/javascript; charset=utf-8" } }); }
    catch { return new Response("Authority source drift", { status: 503, headers }); }
  }
  return new Response(response.body, { headers: { ...headers, "content-type": response.headers.get("content-type") || (asset.endsWith(".html") ? "text/html; charset=utf-8" : asset.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8") } });
}
