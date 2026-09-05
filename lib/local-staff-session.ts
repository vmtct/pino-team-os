export class LocalStaffSessionError extends Error {
  constructor(message = "Staff password session is required") {
    super(message);
    this.name = "LocalStaffSessionError";
  }
}

export function staffPasswordSession(request: Request): string {
  return staffPasswordSessionFromHeaders(request.headers);
}

export function staffPasswordSessionFromHeaders(headers: Headers): string {
  const token = cookie(headers, "pino_staff_password_session");
  if (!token) throw new LocalStaffSessionError();
  return token;
}

export function staffPinSession(request: Request): string {
  return cookie(request.headers, "pino_staff_session");
}

function cookie(headers: Headers, name: string): string {
  return headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}