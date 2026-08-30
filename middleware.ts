import { NextRequest, NextResponse } from "next/server";
import { decideHostBoundary, requiresTosStaffSession } from "@/lib/host-boundary";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;
  const decision = decideHostBoundary(host, pathname);

  if (decision.action === "next") {
    if (requiresTosStaffSession(host, pathname) && !request.cookies.get("pino_staff_session")?.value) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: { code: "STAFF_SESSION_REQUIRED", message: "Staff session is required" } },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }
      const login = new URL(request.url);
      login.pathname = "/staff-login";
      login.search = "";
      return NextResponse.redirect(login, 307);
    }
    return NextResponse.next();
  }
  if (decision.action === "not_found") {
    return new NextResponse("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const destination = new URL(request.url);
  destination.host = host;
  destination.pathname = decision.pathname;
  destination.search = "";
  return NextResponse.redirect(destination, 307);
}
