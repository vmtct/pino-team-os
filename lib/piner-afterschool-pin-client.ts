type PinSession = {
  authState: "PIN_CHANGE_REQUIRED" | "AUTHENTICATED";
  expiresAt: string;
  csrfToken: string;
};

export class AfterschoolPinError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "AfterschoolPinError";
  }
}

async function request(path: string, body?: object, csrfToken?: string): Promise<unknown> {
  const headers = new Headers({ Accept: "application/json" });
  if (body) headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-Pino-CSRF", csrfToken);

  const response = await fetch("/api/piner/afterschool/" + path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    mode: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AfterschoolPinError(response.status, payload?.error?.code ?? "REQUEST_FAILED");
  }
  return payload?.data;
}

function readSession(data: unknown, allowRestricted: boolean): PinSession {
  const value = data as Partial<PinSession> | null;
  if (
    !value ||
    (value.authState !== "AUTHENTICATED" &&
      !(allowRestricted && value.authState === "PIN_CHANGE_REQUIRED")) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    typeof value.csrfToken !== "string" ||
    !/^[A-Za-z0-9_-]{22}$/.test(value.csrfToken)
  ) {
    throw new AfterschoolPinError(502, "INVALID_SESSION_RESPONSE");
  }
  return { authState: value.authState, expiresAt: value.expiresAt, csrfToken: value.csrfToken };
}

export async function loginAfterschool(phone: string, pin: string) {
  return readSession(await request("pin/login", { phone, pin }), true);
}

export async function changeAfterschoolPin(newPin: string, csrfToken: string) {
  return readSession(await request("pin/change", { newPin }, csrfToken), false);
}

export async function restoreAfterschoolSession() {
  const data = (await request("session")) as { authenticated?: boolean } | null;
  if (data?.authenticated !== true) throw new AfterschoolPinError(502, "INVALID_SESSION_RESPONSE");
  return readSession({ ...data, authState: "AUTHENTICATED" }, false);
}

export async function logoutAfterschool(csrfToken: string) {
  await request("logout", {}, csrfToken);
}
