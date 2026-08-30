import type { StaffPinCoreBinding } from "./staff-pin-core";

export function readStaffSessionToken(request: Request): string {
  return request.headers.get("cookie")
    ?.split(";")
    .map(value => value.trim())
    .find(value => value.startsWith("pino_staff_session="))
    ?.slice("pino_staff_session=".length) ?? "";
}

export function missingStaffSessionResponse(): Response {
  return Response.json(
    { error: { code: "STAFF_SESSION_REQUIRED", message: "Staff session is required" } },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export async function validateStaffSession(
  request: Request,
  binding: StaffPinCoreBinding,
): Promise<{ token: string; error?: undefined } | { token?: undefined; error: Response }> {
  const token = readStaffSessionToken(request);
  if (!token) return { error: missingStaffSessionResponse() };
  const result = await binding.resolve(token);
  if (result.status !== 200) {
    return {
      error: Response.json(result.body, {
        status: result.status,
        headers: { "cache-control": "no-store", "x-request-id": result.requestId },
      }),
    };
  }
  return { token };
}
