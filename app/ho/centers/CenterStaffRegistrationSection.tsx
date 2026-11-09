"use client";
// PAP-1542 / PAP-220 — Center-owned Staff registration attribute.
// The public Center-only intake endpoint is not admitted yet, so a bearer
// is never shown as an actionable/shareable URL in this interim Staging UI.
import { TosButton } from "@pino/design-system/react";
import { useEffect, useState } from "react";
import { readFounderStaffLink, type FounderStaffLink } from "@/app/ho/workforce/staff-links/schema";

export function CenterStaffRegistrationSection({ centerId }: { centerId: string }) {
  const [link, setLink] = useState<FounderStaffLink | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLink(null); setError(""); setNotice("");
    void readFounderStaffLink(centerId, fetch, controller.signal)
      .then(value => { if (!controller.signal.aborted) setLink(value); })
      .catch(() => { if (!controller.signal.aborted) setError("Không đọc được trạng thái nhận hồ sơ."); });
    return () => controller.abort();
  }, [centerId, reload]);

  async function toggle() {
    if (!link || busy) return;
    const previous = link;
    const target = !previous.enabled;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/ho/staff-center-links/" + centerId + "/status", {
        method: "POST", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ enabled: target, expectedVersion: previous.version }),
      });
      // Always reread authoritative Core, even for an ambiguous 502/503-after-write.
      const latest = await readFounderStaffLink(centerId, fetch);
      setLink(latest);
      if (!response.ok) {
        throw Error(response.status === 409 ? "Trạng thái đã thay đổi. Vui lòng thử lại."
          : response.status === 403 ? "Bạn không có quyền thay đổi trạng thái."
          : "Không xác nhận được thao tác. Trạng thái đã được tải lại.");
      }
      if (latest.enabled !== target || latest.version <= previous.version) {
        throw Error("Chưa xác minh được trạng thái đã lưu.");
      }
      setNotice(target ? "Đã bật nhận hồ sơ." : "Đã tắt nhận hồ sơ.");
    } catch (cause) {
      // A network failure can occur AFTER Core commits. Keep a fresh state even
      // when POST never returned, but never treat a failed response as success.
      try { setLink(await readFounderStaffLink(centerId, fetch)); } catch { /* Remain fail-closed. */ }
      setError(cause instanceof Error ? cause.message : "Không lưu được trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="v24-prop-section" aria-label="Đăng ký Staff" data-center-staff-registration="">
    <div className="v24-section-heading"><h4>Đăng ký Staff</h4></div>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setReload(v => v + 1)}>Tải lại</button></p> : null}
    {!link && !error ? <p role="status">Đang tải trạng thái nhận hồ sơ…</p> : null}
    {link ? <div className="property-section">
      <div className="v24-prop-item">
        <div className="v24-prop-key">Nhận hồ sơ</div>
        <div className="v24-prop-value">
          <TosButton type="button" role="switch" aria-checked={link.enabled}
            disabled={busy} variant="secondary" onClick={() => void toggle()}>
            {busy ? "Đang lưu…" : link.enabled ? "Bật" : "Tắt"}
          </TosButton>
        </div>
      </div>
      <div className="v24-prop-item">
        <div className="v24-prop-key">Link đăng ký</div>
        <div className="v24-prop-value readonly">
          <span>Link riêng đã được cấp cho Center</span>
          <TosButton type="button" variant="secondary" disabled aria-disabled="true"
            aria-label="Sao chép link" title="Sao chép link">
            ⧉
          </TosButton>
        </div>
      </div>
      <div className="v24-prop-item">
        <div className="v24-prop-key">Cập nhật</div>
        <div className="v24-prop-value readonly">{link.updatedAt
          ? new Date(link.updatedAt).toLocaleString("vi-VN") : "Chưa thay đổi"}</div>
      </div>
    </div> : null}
    {link ? <p role="status">Sao chép link hiện chưa khả dụng.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
