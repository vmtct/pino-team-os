import { NextRequest, NextResponse } from "next/server";

const STAFF_PREFIX = "/s/";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(STAFF_PREFIX)) return NextResponse.next();

  const username = pathname.slice(STAFF_PREFIX.length).split("/")[0]?.trim();
  const headers = new Headers(request.headers);
  if (username) headers.set("x-pino-staff-username", decodeURIComponent(username));

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
