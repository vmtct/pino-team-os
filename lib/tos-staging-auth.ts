export type TosStagingAuthEnv = {
  PINORIA_TOS_STAGING_BYPASS?: string;
  PINORIA_STAGING_STAFF_EMAIL?: string;
};

export function isTosStagingBypassRequest(request: Request, env: TosStagingAuthEnv) {
  if (env.PINORIA_TOS_STAGING_BYPASS !== "enabled") return false;
  const headerHost = request.headers.get("host")?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  const hostname = headerHost || new URL(request.url).hostname.toLowerCase();
  return hostname.endsWith(".workers.dev");
}

export function stagingStaffEmail(request: Request, env: TosStagingAuthEnv) {
  if (!isTosStagingBypassRequest(request, env)) return null;
  const email = env.PINORIA_STAGING_STAFF_EMAIL?.trim().toLowerCase() ?? "";
  return email && email.includes("@") ? email : null;
}
