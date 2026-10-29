"use client";
import { useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";

type Link =
  | { state: "loading" }
  | { state: "ready"; userId: string; email: string | null }
  | { state: "unavailable"; message: string };
type Props = { staffId: string; displayName: string; active: boolean; authorized: boolean; principalId: string };
export function findResetAccount(rows: readonly BoAccessSystemUser[], staffId: string, principalId: string): Link {
  const matches = rows.filter(user => user.staffMemberId === staffId);
  if (matches.length !== 1) return { state: "unavailable", message: matches.length ? "Liên kết Staff/Access không duy nhất." : "Staff chưa có tài khoản đăng nhập được liên kết." };
  const account = matches[0]!;
  if (account.id === principalId) return { state: "unavailable", message: "Không thể reset mật khẩu của chính mình." };
  if (account.status !== "active") return { state: "unavailable", message: "Tài khoản Access chưa hoạt động." };
  return { state: "ready", userId: account.id, email: account.email };
}
export function StaffPasswordReset({ staffId, displayName, active, authorized, principalId }: Props) {
  const [link, setLink] = useState<Link>({ state: "loading" });
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let current = true;
    setTemporaryPassword(null); setCopied(false); setError("");
    if (!authorized || !active) return () => { current = false; request.current?.abort(); };
    void boApi.accessUsers().then(users => {
      if (current) setLink(findResetAccount(users, staffId, principalId));
    }).catch(() => {
      if (current) setLink({ state: "unavailable", message: "Không tải được liên kết tài khoản Access." });
    });
    const hide = () => { if (document.visibilityState === "hidden") { setTemporaryPassword(null); setCopied(false); } };
    document.addEventListener("visibilitychange", hide);
    return () => {
      current = false; request.current?.abort(); document.removeEventListener("visibilitychange", hide);
    };
  }, [staffId, authorized, active, principalId]);
  async function reset() {
    if (!authorized || !active || link.state !== "ready" || inFlight.current) return;
    if (!window.confirm(`Reset password cho ${displayName} (${link.email ?? "Staff"})?\nMật khẩu hiện tại và các phiên đăng nhập sẽ bị thu hồi. Mật khẩu tạm chỉ hiển thị một lần.`)) return;
    inFlight.current = true;
    setBusy(true); setError(""); setTemporaryPassword(null); setCopied(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/ho/staff/${encodeURIComponent(staffId)}/password-reset`, {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: "{}", signal: controller.signal,
      });
      if (!response.ok) {
        setError(response.status === 403 ? "Không có quyền reset mật khẩu." :
          response.status === 404 ? "Không tìm thấy tài khoản Staff." :
          response.status === 409 ? "Tài khoản không còn hợp lệ để reset." :
          "Reset chưa được xác nhận. Kiểm tra trạng thái Access trước khi thử lại.");
        return;
      }
      const payload: unknown = await response.json();
      const data = (payload && typeof payload === "object" && "data" in payload) ? payload.data : null;
      if (!data || typeof data !== "object" || !("userId" in data) || data.userId !== link.userId ||
        !("staffMemberId" in data) || data.staffMemberId !== staffId || !("temporaryPassword" in data) ||
        typeof data.temporaryPassword !== "string" || !data.temporaryPassword) {
        setError("Core đã xử lý nhưng không trả mật khẩu tạm hợp lệ. Không tự động thực hiện lại.");
        return;
      }
      if (!controller.signal.aborted && document.visibilityState === "visible") setTemporaryPassword(data.temporaryPassword);
    } catch {
      if (!controller.signal.aborted) setError("Chưa xác minh được kết quả. Kiểm tra Access trước khi reset lại.");
    } finally {
      if (!controller.signal.aborted) { inFlight.current = false; setBusy(false); }
      request.current = null;
    }
  }
  return <section className="v24-prop-section" aria-label="Bảo mật tài khoản" data-testid="ho-staff-password-reset">
    <h3>Bảo mật tài khoản</h3>
    <p>Reset password sẽ thu hồi mật khẩu và phiên đăng nhập hiện tại. Staff phải đổi mật khẩu tạm ở lần đăng nhập tiếp theo.</p>
    {!authorized ? <p role="status">Bạn không có quyền reset mật khẩu Staff.</p> :
      !active ? <p role="status">Chỉ reset được Staff đang hoạt động.</p> :
      link.state === "loading" ? <p role="status">Đang kiểm tra tài khoản Access…</p> :
      link.state === "unavailable" ? <p role="status">{link.message}</p> :
      <><p>{link.email ?? "Chưa có email"} · Access đang hoạt động</p>
        <button type="button" className="secondary-btn" disabled={busy} onClick={() => void reset()}>
          {busy ? "Đang reset…" : "Reset password"}
        </button>
        {temporaryPassword ? <div role="status" data-testid="ho-reset-password-reveal">
          <p>Mật khẩu tạm · chỉ hiển thị một lần</p>
          <code data-testid="ho-reset-password-value">{temporaryPassword}</code>
          <div><button type="button" className="secondary-btn" onClick={async () => {
            try { await navigator.clipboard.writeText(temporaryPassword); setCopied(true); }
            catch { setError("Không sao chép được. Hãy copy thủ công."); }
          }}>{copied ? "Đã sao chép" : "Sao chép"}</button>
          <button type="button" className="secondary-btn" onClick={() => { setTemporaryPassword(null); setCopied(false); }}>Ẩn mật khẩu</button></div>
        </div> : null}
      </>}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
