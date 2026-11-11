"use client";
// PAP-1838 / PNR-IDENTITY — same-origin Piner BFF only; never fake login success.
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  challengeDeadline, maskPinerPhone, normalizePinerPhone,
  pinerAuthError, RESEND_COOLDOWN_MS, safePinerReturnTo,
} from "@/lib/piner-login-policy";
import styles from "./piner-login.module.css";

type Result = { data?: { challengeId?: unknown; expiresAt?: unknown; authenticated?: unknown } };
async function callBff(path: string, method: "GET" | "POST", data?: object) {
  return fetch("/api/piner/auth/" + path, {
    method, credentials: "same-origin", cache: "no-store",
    ...(data ? { body: JSON.stringify(data), headers: { "Content-Type": "application/json" } } : {}),
  });
}
function mmss(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}
export default function PinerLoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const destination = safePinerReturnTo(returnTo);
  const [restoring, setRestoring] = useState(true);
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [enteredPhone, setEnteredPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expiry, setExpiry] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"request" | "verify" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/piner/auth/session", {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(r => {
      if (r.ok && !controller.signal.aborted) router.replace(destination);
    }).catch(() => {
      // Backend unavailable: do not claim an authenticated session.
    }).finally(() => {
      if (!controller.signal.aborted) setRestoring(false);
    });
    return () => controller.abort();
  }, [destination, router]);

  async function sendOtp(to: string) {
    if (busy || Date.now() < resendAt) return;
    setBusy("request");
    setError("");
    try {
      const response = await callBff("otp/request", "POST", { phone: to });
      if (response.status !== 202) {
        setError(pinerAuthError(response.status, "request"));
        if (response.status === 429) setResendAt(Date.now() + RESEND_COOLDOWN_MS);
        return;
      }
      const { data } = await response.json() as Result;
      const deadline = challengeDeadline(data?.expiresAt, Date.now());
      if (!deadline || typeof data?.challengeId !== "string"
        || !/^[0-9a-f-]{36}$/i.test(data.challengeId)) {
        setError("Dịch vụ xác thực chưa sẵn sàng. Vui lòng thử lại sau.");
        return;
      }
      setPhone(to);
      setChallengeId(data.challengeId);
      setExpiry(deadline);
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
      setOtp("");
      setStage("otp");
    } catch {
      setError("Không kết nối được dịch vụ xác thực. Vui lòng thử lại sau.");
    } finally {
      setBusy(null);
    }
  }
  function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const canonical = normalizePinerPhone(enteredPhone);
    if (!canonical) {
      setError("Vui lòng nhập số điện thoại di động Việt Nam hợp lệ.");
      return;
    }
    void sendOtp(canonical);
  }
  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!challengeId || otp.length !== 6 || Date.now() >= expiry) {
      setError(Date.now() >= expiry ? "Mã đã hết hạn. Vui lòng yêu cầu mã mới." : "Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    setBusy("verify");
    setError("");
    try {
      const result = await callBff("otp/verify", "POST", { challengeId, otp });
      if (!result.ok) {
        setError(pinerAuthError(result.status, "verify"));
        setOtp("");
        return;
      }
      const body = await result.json() as Result;
      if (body.data?.authenticated !== true) {
        setError("Chưa thể xác minh phiên đăng nhập. Vui lòng thử lại.");
        return;
      }
      // Core must authorize the sealed cookie before navigating to a member page.
      const session = await callBff("session", "GET");
      if (!session.ok) {
        setError("Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.");
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Không thể xác minh mã. Vui lòng thử lại sau.");
    } finally {
      setBusy(null);
    }
  }

  const remaining = Math.max(0, expiry - now);
  const resendRemaining = Math.max(0, resendAt - now);

  return <section className={styles.card} data-login-gate="piner-bff-otp" aria-labelledby="piner-login-title">
    <p className={styles.brand} aria-label="PINO · Piner APP">PINO <span>Piner APP</span></p>
    <span className={styles.eyebrow}>TÀI KHOẢN PINO</span>
    <h1 id="piner-login-title">Đăng nhập Piner APP</h1>
    <p className={styles.intro}>Dùng số điện thoại đã đăng ký với PINO để tiếp tục hành trình của bạn.</p>
    {restoring ? <p role="status" className={styles.notice}>Đang kiểm tra phiên đăng nhập…</p>
    : stage === "phone" ?
      <form className={styles.form} onSubmit={requestOtp}>
        <label htmlFor="piner-phone">Số điện thoại</label>
        <input id="piner-phone" type="tel" inputMode="tel" autoComplete="tel-national"
          placeholder="09xx xxx xxx" maxLength={22} value={enteredPhone}
          onChange={e => setEnteredPhone(e.target.value)}
          disabled={busy !== null} required aria-describedby="piner-phone-hint" />
        <small id="piner-phone-hint" className={styles.hint}>Mã xác thực 6 chữ số được gửi qua Zalo.</small>
        <button type="submit" className={styles.primary} disabled={busy !== null}>
          {busy ? "Đang yêu cầu mã…" : "Nhận mã xác thực"}
        </button>
      </form> :
      <form className={styles.form} onSubmit={verifyOtp}>
        <p className={styles.phoneHint}>Mã xác thực đã được yêu cầu cho <strong>{maskPinerPhone(phone)}</strong>.</p>
        <label htmlFor="piner-otp">Mã xác thực</label>
        <input id="piner-otp" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required placeholder="● ● ● ● ● ●"
          value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={busy !== null} aria-describedby="piner-otp-expiry" />
        <div className={styles.otpActions}>
          <span id="piner-otp-expiry" role="timer" aria-live="off">
            {remaining > 0 ? "Mã còn hiệu lực " + mmss(remaining) : "Mã đã hết hạn"}
          </span>
          <button type="button" className={styles.linkButton}
            onClick={() => void sendOtp(phone)} disabled={busy !== null || resendRemaining > 0}>
            {resendRemaining > 0 ? "Gửi lại sau " + Math.ceil(resendRemaining / 1000) + "s" : "Gửi lại mã"}
          </button>
        </div>
        <button type="submit" className={styles.primary}
          disabled={busy !== null || otp.length !== 6 || remaining === 0}>
          {busy === "verify" ? "Đang xác minh…" : "Xác minh và tiếp tục"}
        </button>
        <button type="button" className={styles.textButton} disabled={busy !== null}
          onClick={() => { setStage("phone"); setOtp(""); setResendAt(0); setError(""); }}>
          Đổi số điện thoại
        </button>
      </form>}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <p className={styles.footnote}>Chỉ dành cho tài khoản PINO hiện có; không tự tạo tài khoản mới.</p>
    <a className={styles.back} href={destination}>‹ Quay lại trang đang xem</a>
  </section>;
}
