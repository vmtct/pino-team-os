import type { StaffPasswordCoreBinding } from "./staff-password-core";
import type { StaffPinCoreBinding } from "./staff-pin-core";

export type StaffLogoutEnv = {
  PINO_STAFF_PASSWORD_CORE: StaffPasswordCoreBinding;
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
};

export async function handleStaffLogout(request: Request, env?: StaffLogoutEnv): Promise<Response> {
  const passwordToken = cookie(request, "pino_staff_password_session");
  const pinToken = cookie(request, "pino_staff_session");

  if (env) {
    const revocations: Promise<unknown>[] = [];
    if (passwordToken) revocations.push(env.PINO_STAFF_PASSWORD_CORE.logout(passwordToken));
    if (pinToken) revocations.push(env.PINO_STAFF_PIN_CORE.logout(pinToken));
    if (revocations.length) await Promise.allSettled(revocations);
  }

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", "pino_staff_password_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  headers.append("set-cookie", "pino_staff_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return Response.json({ data: { revoked: true } }, { status: 200, headers });
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
