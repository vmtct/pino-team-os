import { NextRequest, NextResponse } from "next/server";
import { HO_STAGING_HOSTNAME, normalizeHostname, decideHostBoundary, requiresBoStaffPasswordSession, requiresTosStaffSession } from "@/lib/host-boundary";
import { boSkeletonRoute, requiresBoStagingPageSession } from "@/lib/bo-skeleton-routing";

export function middleware(request: NextRequest) {
  // Source assets are served only through the authenticated staging controller.
  if (request.nextUrl.pathname.startsWith("/bo-authority-source/")) return new NextResponse("Not Found", { status: 404 });
  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  // Never trust a caller-supplied internal route marker.
  const forwarded = new Headers(request.headers);
  forwarded.delete("x-pino-bo-runtime-path");
  if (requiresBoStagingPageSession(host, request.nextUrl.pathname)) forwarded.set("x-pino-bo-runtime-path", request.nextUrl.pathname);
  // Isolated HO prototype: only synthetic read-only pages and public presentation assets.
  // The prototype Worker has no Core, D1, email, or outbound service bindings.
  if (normalizeHostname(host) === "ho.proto.pinohouse.art") {
    const pathname = request.nextUrl.pathname;
    if (request.method !== "GET" && request.method !== "HEAD") return new NextResponse("Not Found", {status:404});
    if (pathname === "/" || pathname === "/ho") {
      return NextResponse.redirect(new URL("/ho/centers", request.url), 307);
    }
    const allowed = /^\/ho\/(?:centers|system\/(?:users|roles|audit)|learning\/(?:syllabi|missions)|pinoria\/(?:worlds|wardrobe|wardrobe-sets|effects|tv-policy|wish|activities)|content\/website-cms)$/.test(pathname);
    if (allowed) {
      const dest=request.nextUrl.clone();
      dest.pathname=pathname.replace(/^\/ho\//,"/ho-prototype/");
      return NextResponse.rewrite(dest);
    }
    if (pathname.startsWith("/_next/") || /^\/bo-skeleton\/(?:styles|playground|playground-v22|playground-v23|full-detail-v24|full-detail-v25)\.css$/.test(pathname) ||
       /^\/(?:favicon\.ico|[a-zA-Z0-9_-]+\.(?:svg|png|webp|woff2))$/.test(pathname)) {
      return NextResponse.next();
    }
    return new NextResponse("Not Found", {status:404,headers:{"cache-control":"no-store"}});
  }
  const schoolRoute = boSkeletonRoute(host, request.nextUrl.pathname);
  if (schoolRoute === "redirect") {
    const target = request.nextUrl.clone();
    target.pathname = "/bo";
    return NextResponse.redirect(target, 307);
  }
  const decision = decideHostBoundary(host, request.nextUrl.pathname, request.method);

  if (decision.action === "next") {
    if (normalizeHostname(host) === HO_STAGING_HOSTNAME && request.nextUrl.pathname.startsWith("/ho") && !request.cookies.get("pino_staff_password_session")?.value) {
      return NextResponse.redirect(new URL("/staff-login", request.url), 307);
    }
    if (requiresTosStaffSession(host, request.nextUrl.pathname) && !request.cookies.get("pino_support_session")?.value && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL(request.url); login.pathname = "/staff-login"; login.search = "";
      return NextResponse.redirect(login, 307);
    }
    // Before React starts streaming: an async layout redirect can otherwise be HTTP 200.
    if ((requiresBoStaffPasswordSession(host, request.nextUrl.pathname) || requiresBoStagingPageSession(host, request.nextUrl.pathname)) && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL(request.url); login.pathname = "/staff-login"; login.search = "";
      return NextResponse.redirect(login, 307);
    }
    return NextResponse.next({ request: { headers: forwarded } });
  }
  if (decision.action === "not_found") {
    return new NextResponse("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const destination = new URL(request.url);
  destination.host = request.headers.get("host") ?? request.nextUrl.host;
  destination.pathname = decision.pathname;
  destination.search = "";
  return NextResponse.redirect(destination, 307);
}
