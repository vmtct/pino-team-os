import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.headers.get("CF-Access-JWT-Assertion");

  // Local development can run without Cloudflare Access. Production cannot.
  if (!token && process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // The production schedule diagnostic is protected at the route level by a
  // dedicated secret so GitHub Actions can verify real schedule data without
  // requiring a short-lived human Cloudflare Access JWT.
  if (request.nextUrl.pathname === "/api/debug/schedule") {
    return NextResponse.next();
  }

  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const identity = await authenticateRequest(request);
    const headers = new Headers(request.headers);
    headers.set("x-pino-user-id", identity.userId);
    headers.set("x-pino-user-email", identity.email);
    headers.set("x-pino-user-name", identity.name);

    return NextResponse.next({ request: { headers } });
  } catch (error) {
    console.error("[Auth] Cloudflare Access verification failed", {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : undefined,
    });
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico).*)",
  ],
};
