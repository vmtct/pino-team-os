export type PinoriaTvAuthEnv = {
  PINORIA_TV_DEVICE_TOKEN?: string;
  PINORIA_TV_STAGING_BYPASS?: string;
};

export class PinoriaTvAuthError extends Error {
  constructor(readonly status: 401 | 503, message: string) {
    super(message);
  }
}

export function isPinoriaTvStagingBypass(url: string, flag?: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  return flag === "enabled" && hostname.endsWith(".workers.dev");
}

export async function authenticatePinoriaTvRequest(request: Request, env: PinoriaTvAuthEnv) {
  if (isPinoriaTvStagingBypass(request.url, env.PINORIA_TV_STAGING_BYPASS)) return;
  const expected = env.PINORIA_TV_DEVICE_TOKEN?.trim();
  if (!expected) throw new PinoriaTvAuthError(503, "Pinoria TV device authentication is unavailable");
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  if (!match || !(await equalToken(match[1]!, expected))) throw new PinoriaTvAuthError(401, "Pinoria TV device authentication failed");
}
async function equalToken(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index]! ^ right[index]!;
  return diff === 0;
}
