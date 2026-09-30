import type { StaffPasswordCoreBinding } from "./staff-password-core";

export type StaffLogoutEnv = {
  PINO_STAFF_PASSWORD_CORE: StaffPasswordCoreBinding;
};

export async function handleStaffLogout(request: Request, env?: StaffLogoutEnv): Promise<Response> {
  const supportToken = cookie(request, "pino_support_session");
  const passwordToken = cookie(request, "pino_staff_password_session");

  if (env) {
    const revocations: Promise<unknown>[] = [];
    if (supportToken && env.PINO_STAFF_PASSWORD_CORE.supportLogout) revocations.push(env.PINO_STAFF_PASSWORD_CORE.supportLogout(supportToken));
    if (passwordToken) revocations.push(env.PINO_STAFF_PASSWORD_CORE.logout(passwordToken));
    if (revocations.length) await Promise.allSettled(revocations);
  }

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", "pino_support_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  headers.append("set-cookie", "pino_staff_password_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  // Expire the retired legacy cookie during cutover; it no longer authenticates any route.
  headers.append("set-cookie", "pino_staff_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return Response.json({ data: { revoked: true } }, { status: 200, headers });
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
