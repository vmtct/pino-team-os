import type { StaffPasswordCoreBinding } from "./staff-password-core";

export type StaffLogoutEnv = {
  PINO_STAFF_PASSWORD_CORE: StaffPasswordCoreBinding;
};

export async function handleStaffLogout(request: Request, env?: StaffLogoutEnv): Promise<Response> {
  const passwordToken = cookie(request, "pino_staff_password_session");

  if (env && passwordToken) {
    await Promise.allSettled([env.PINO_STAFF_PASSWORD_CORE.logout(passwordToken)]);
  }

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", "pino_staff_password_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  // Expire the retired legacy cookie during cutover; it no longer authenticates any route.
  headers.append("set-cookie", "pino_staff_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return Response.json({ data: { revoked: true } }, { status: 200, headers });
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
