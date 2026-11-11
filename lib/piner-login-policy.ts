// PAP-1838 / PNR-IDENTITY — shared deterministic login UI input policy.
// Never persist OTP, phone or Core bearer in localStorage or query strings.
export const PINER_PUBLIC_HOME = "/piner/public";
export const OTP_LIFETIME_MS = 5 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
const BASE_ORIGIN = "https://piner.invalid";

export function safePinerReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 512 || !raw.startsWith("/piner")
    || raw.startsWith("//") || /[\u0000-\u001F\u007F\\]/.test(raw)
    || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw)) return PINER_PUBLIC_HOME;
  try {
    const url = new URL(raw, BASE_ORIGIN);
    if (url.origin !== BASE_ORIGIN || !/^\/piner(?:\/|$)/.test(url.pathname)
      || url.pathname.startsWith("/piner/public/login")) return PINER_PUBLIC_HOME;
    return url.pathname + url.search + url.hash;
  } catch { return PINER_PUBLIC_HOME; }
}

export function normalizePinerPhone(raw: string): string | null {
  const value = raw.replace(/[\s().-]/g, "");
  const canonical = value.startsWith("0") && value.length === 10
    ? "+84" + value.slice(1)
    : value.startsWith("84") && value.length === 11
      ? "+" + value
      : value;
  return /^\+84[35789]\d{8}$/.test(canonical) ? canonical : null;
}

export function maskPinerPhone(phone: string): string {
  return "+84 ••• ••• " + phone.slice(-3);
}

export function challengeDeadline(raw: unknown, now: number): number | null {
  if (typeof raw !== "string") return null;
  const expiry = Date.parse(raw);
  return Number.isFinite(expiry) && expiry > now && expiry <= now + OTP_LIFETIME_MS + 60_000
    ? expiry : null;
}

export function pinerAuthError(status: number, phase: "request" | "verify"): string {
  if (status === 429) return "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.";
  if (status === 403) return "Phiên truy cập không hợp lệ. Vui lòng tải lại trang.";
  if (status === 401 && phase === "verify") return "Mã xác thực chưa đúng hoặc đã hết hạn.";
  if (status === 400) return phase === "request"
    ? "Vui lòng kiểm tra lại số điện thoại."
    : "Mã OTP phải gồm 6 chữ số.";
  return "Đăng nhập qua Zalo hiện chưa sẵn sàng. Vui lòng thử lại sau.";
}
