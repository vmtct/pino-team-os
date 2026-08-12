import { getConfigBoolean, getConfigValue } from "@/lib/repositories/web-config";
import { staffByUsername } from "@/lib/repositories/staff-access";
import { hasCompanionAccess } from "@/lib/repositories/companion";

const COOKIE = "pino_companion_session";
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const unb64 = (value: string) => new Uint8Array(Buffer.from(value, "base64url"));

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(value))));
}

export async function companionEnabled(): Promise<boolean> {
  return getConfigBoolean("companion_enabled", false);
}

export async function authenticateCompanion(username: string, password: string): Promise<boolean> {
  if (!(await companionEnabled())) return false;
  const expectedUser = await getConfigValue("companion_auth_username", "companion");
  const expectedHash = await getConfigValue("companion_auth_password_hash", "");
  if (!expectedHash || username.trim() !== expectedUser) return false;
  return (await sha256(password)) === expectedHash;
}

export async function createCompanionSession(mobile: string): Promise<string> {
  const ttl = Math.max(1, Number(await getConfigValue("companion_session_ttl_hours", "12")) || 12);
  const exp = Date.now() + ttl * 60 * 60 * 1000;
  const passwordHash = await getConfigValue("companion_auth_password_hash", "");
  const payload = `${mobile}.${exp}`;
  const sig = await hmac(payload, passwordHash);
  return `${b64(enc.encode(payload))}.${sig}`;
}

export async function verifyCompanionSession(token: string): Promise<boolean> {
  try {
    const [payload64, sig] = token.split(".");
    if (!payload64 || !sig) return false;
    const payload = new TextDecoder().decode(unb64(payload64));
    const [mobile, expText] = payload.split(".");
    const exp = Number(expText);
    if (!mobile || !Number.isFinite(exp) || exp < Date.now()) return false;
    const passwordHash = await getConfigValue("companion_auth_password_hash", "");
    if (!passwordHash || sig !== await hmac(payload, passwordHash)) return false;
    const staff = await staffByUsername(mobile);
    return Boolean(staff && hasCompanionAccess(staff));
  } catch { return false; }
}

export async function companionCookieName(): Promise<string> { return COOKIE; }
export { COOKIE };
