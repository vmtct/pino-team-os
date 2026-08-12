import { NextRequest, NextResponse } from "next/server";

const STAFF_PREFIX = "/s/";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(STAFF_PREFIX)) return NextResponse.next();

  const username = pathname.slice(STAFF_PREFIX.length).split("/")[0]?.trim();
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  if (!username) return response;

  const headers = new Headers(request.headers);
  headers.set("x-pino-staff-username", decodeURIComponent(username));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
