import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { isControllerLeaseOwner } from "../../../../lib/pinoria-prototype/controller-lease";
import { resolvePinoriaStaff } from "../../../../lib/pinoria-prototype/staff-auth";
import type { PinoriaWishCoreEnv, TosLearningResponse } from "../../../../lib/pinoria-wish-core";

export const runtime = "nodejs";

const COOKIE = "pino_pinoria_staff_pin";
const SURFACE_ID = "RECEPTION_TV";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

type StaffPinLoginData = {
  token: string;
  expiresAt: string;
  principal: { email?: string };
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function data<T>(body: unknown): T | null {
  const value = object(body).data;
  return value && typeof value === "object" ? value as T : null;
}

function configuredCenter(env: PinoriaWishCoreEnv) {
  const centerId = env.PINORIA_CENTER_ID?.trim();
  if (!centerId || !UUID.test(centerId)) throw new Error("PINORIA_CENTER_ID_UNAVAILABLE");
  return centerId;
}

function setSessionCookie(response: NextResponse, token: string, expiresAt: string, request: NextRequest) {
  const expiresMs = Date.parse(expiresAt);
  const maxAge = Number.isFinite(expiresMs) ? Math.max(60, Math.floor((expiresMs - Date.now()) / 1000)) : 12 * 60 * 60;
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/pinoria-prototype/wish-control",
    maxAge,
  });
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/api/pinoria-prototype/wish-control", maxAge: 0 });
}

function proxyCore(result: TosLearningResponse) {
  const response = json(result.body, result.status);
  response.headers.set("x-request-id", result.requestId);
  if (result.status === 401) clearSessionCookie(response);
  return response;
}

async function env(): Promise<PinoriaWishCoreEnv> {
  const context = await getCloudflareContext({ async: true }) as unknown as { env: PinoriaWishCoreEnv };
  return context.env;
}

async function login(request: NextRequest, body: JsonObject, core: PinoriaWishCoreEnv) {
  const staffToken = typeof body.staffToken === "string" ? body.staffToken.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const staff = await resolvePinoriaStaff(staffToken);
  if (!staff?.email) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  const result = await core.PINO_STAFF_PIN_CORE.login({ loginIdentifier: staff.email, pin });
  if (result.status !== 200) return json(result.body, result.status);
  const loggedIn = data<StaffPinLoginData>(result.body);
  if (!loggedIn?.token || !loggedIn.expiresAt) return json({ ok: false, error: "CORE_SESSION_INVALID" }, 502);
  const coreEmail = loggedIn.principal?.email?.trim().toLowerCase();
  if (!coreEmail || coreEmail !== staff.email) {
    await core.PINO_STAFF_PIN_CORE.logout(loggedIn.token).catch(() => undefined);
    return json({ ok: false, error: "STAFF_IDENTITY_MISMATCH" }, 403);
  }
  const response = json({ ok: true, data: { expiresAt: loggedIn.expiresAt } });
  setSessionCookie(response, loggedIn.token, loggedIn.expiresAt, request);
  return response;
}

async function logout(request: NextRequest, core: PinoriaWishCoreEnv) {
  const token = request.cookies.get(COOKIE)?.value ?? "";
  if (token) await core.PINO_STAFF_PIN_CORE.logout(token).catch(() => undefined);
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
}

async function snapshot(token: string, core: PinoriaWishCoreEnv, centerId: string) {
  const [presence, banners] = await Promise.all([
    core.PINO_TV_CORE.snapshot(centerId),
    core.PINO_TOS_CORE.executeWithStaffPin({
      method: "GET",
      path: "pinoria/wish/banners/active",
      body: { centerId },
    }, token),
  ]);
  if (banners.status !== 200) return proxyCore(banners);
  return json({
    ok: true,
    data: {
      centerId,
      learners: presence.learners,
      banners: object(banners.body).data ?? [],
    },
  });
}

async function state(token: string, core: PinoriaWishCoreEnv, centerId: string, body: JsonObject) {
  const studentProfileId = typeof body.studentProfileId === "string" ? body.studentProfileId : "";
  const bannerId = typeof body.bannerId === "string" ? body.bannerId : "";
  if (!UUID.test(studentProfileId) || !UUID.test(bannerId)) return json({ ok: false, error: "INVALID_WISH_CONTEXT" }, 400);
  return proxyCore(await core.PINO_TOS_CORE.executeWithStaffPin({
    method: "GET",
    path: "pinoria/wish/state",
    body: { centerId, studentProfileId, bannerId },
  }, token));
}

async function draw(token: string, core: PinoriaWishCoreEnv, centerId: string, body: JsonObject) {
  const staffToken = typeof body.staffToken === "string" ? body.staffToken.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const studentProfileId = typeof body.studentProfileId === "string" ? body.studentProfileId : "";
  const bannerId = typeof body.bannerId === "string" ? body.bannerId : "";
  const count = body.count === 5 ? 5 : body.count === 1 ? 1 : 0;
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const staff = await resolvePinoriaStaff(staffToken);
  if (!staff) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (!isControllerLeaseOwner(SURFACE_ID, staff.id, clientId)) {
    return json({ ok: false, error: "CONTROLLER_LEASE_REQUIRED" }, 409);
  }
  if (!UUID.test(studentProfileId) || !UUID.test(bannerId) || !count || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return json({ ok: false, error: "INVALID_WISH_DRAW" }, 400);
  }
  return proxyCore(await core.PINO_TOS_CORE.executeWithStaffPin({
    method: "POST",
    path: "pinoria/wish/draw",
    body: { centerId, studentProfileId, bannerId, count },
    idempotencyKey,
  }, token));
}

export async function POST(request: NextRequest) {
  try {
    const body = object(await request.json().catch(() => ({})));
    const op = typeof body.op === "string" ? body.op : "";
    if (op === "login") return login(request, body, await env());
    const token = request.cookies.get(COOKIE)?.value ?? "";
    if (op === "logout") {
      if (!token) {
        const response = json({ ok: true });
        clearSessionCookie(response);
        return response;
      }
      return logout(request, await env());
    }
    if (!token) return json({ ok: false, error: "STAFF_PIN_REQUIRED" }, 401);
    const core = await env();
    const centerId = configuredCenter(core);
    if (op === "snapshot") return snapshot(token, core, centerId);
    if (op === "state") return state(token, core, centerId, body);
    if (op === "draw") return draw(token, core, centerId, body);
    return json({ ok: false, error: "UNSUPPORTED_OPERATION" }, 400);
  } catch (error) {
    console.error("Pinoria Wish control failure", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "WISH_CORE_UNAVAILABLE" }, 503);
  }
}