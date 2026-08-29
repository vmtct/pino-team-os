import { NextRequest, NextResponse } from "next/server";
import { decideHostBoundary, requiresTosStaffSession } from "@/lib/host-boundary";

export function middleware(request: NextRequest) {
  const decision = decideHostBoundary(request.headers.get("host") ?? request.nextUrl.hostname, request.nextUrl.pathname);

  if (decision.action === "next") {
    if (requiresTosStaffSession(request.headers.get("host") ?? request.nextUrl.hostname, request.nextUrl.pathname) && !request.cookies.get("pino_staff_session")?.value) {
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
