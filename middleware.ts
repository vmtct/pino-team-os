import { NextRequest, NextResponse } from "next/server";
import { HO_STAGING_HOSTNAME, normalizeHostname, decideHostBoundary, requiresBoStaffPasswordSession, requiresTosStaffSession } from "@/lib/host-boundary";
import { boSkeletonRoute, requiresBoStagingPageSession } from "@/lib/bo-skeleton-routing";
import { safeHoReturnTo } from "@/lib/ho-routes";

export function middleware(request: NextRequest) {
  // Source assets are served only through the authenticated staging controller.
  if (request.nextUrl.pathname.startsWith("/bo-authority-source/")) return new NextResponse("Not Found", { status: 404 });
  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  // Never trust a caller-supplied internal route marker.
  const forwarded = new Headers(request.headers);
  forwarded.delete("x-pino-bo-runtime-path");
  forwarded.delete("x-pino-ho-auth-page");
  forwarded.delete("x-pino-ho-return-to");
  if (normalizeHostname(host) === HO_STAGING_HOSTNAME && request.nextUrl.pathname.startsWith("/ho")) {
    const ret = safeHoReturnTo(request.nextUrl.pathname + request.nextUrl.search);
    if (ret) forwarded.set("x-pino-ho-return-to",ret);
  }
  if (requiresBoStagingPageSession(host, request.nextUrl.pathname)) forwarded.set("x-pino-bo-runtime-path", request.nextUrl.pathname);
  // Public Staff auth pages must not load the restricted HO authority CSS.
  // The marker is set by middleware, never trusted from caller headers.
  if (normalizeHostname(host) === HO_STAGING_HOSTNAME &&
      ["/staff-login", "/staff-password/change"].includes(request.nextUrl.pathname)) {
    forwarded.set("x-pino-ho-auth-page", "1");
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
      const login = new URL("/staff-login", request.url);
      const ret = safeHoReturnTo(request.nextUrl.pathname + request.nextUrl.search);
      if (ret) login.searchParams.set("returnTo", ret);
      return NextResponse.redirect(login, 307);
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
