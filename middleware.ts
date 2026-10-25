import { NextRequest, NextResponse } from "next/server";
import { decideHostBoundary, requiresBoStaffPasswordSession, requiresTosStaffSession } from "@/lib/host-boundary";
import { boSkeletonRoute } from "@/lib/bo-skeleton-routing";

export function middleware(request: NextRequest) {
  // Source assets are served only through the authenticated staging controller.
  if (request.nextUrl.pathname.startsWith("/bo-authority-source/")) return new NextResponse("Not Found", { status: 404 });
  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  const schoolRoute = boSkeletonRoute(host, request.nextUrl.pathname);
  if (schoolRoute) {
    const target = request.nextUrl.clone();
    target.pathname = schoolRoute === "rewrite" ? "/bo-skeleton/playground.html" : "/bo";
    return schoolRoute === "rewrite" ? NextResponse.rewrite(target) : NextResponse.redirect(target, 307);
  }
  const decision = decideHostBoundary(host, request.nextUrl.pathname);

  if (decision.action === "next") {
    if (requiresTosStaffSession(host, request.nextUrl.pathname) && !request.cookies.get("pino_support_session")?.value && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL(request.url); login.pathname = "/staff-login"; login.search = "";
      return NextResponse.redirect(login, 307);
    }
    if (requiresBoStaffPasswordSession(host, request.nextUrl.pathname) && !request.cookies.get("pino_staff_password_session")?.value) {
      const login = new URL(request.url); login.pathname = "/staff-login"; login.search = "";
      return NextResponse.redirect(login, 307);
    }
    return NextResponse.next();
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
