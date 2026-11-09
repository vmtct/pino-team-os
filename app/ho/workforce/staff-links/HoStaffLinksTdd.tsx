"use client";
// PAP-1407 / PAP-220 — Founder HO Staff link Table → Drawer → Detail.
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { TosButton } from "@pino/design-system/react";
import { useEffect, useState } from "react";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { linkDefinition, linkFields, linkProvider, linkQuery, readFounderStaffLink, type FounderStaffLink } from "./schema";

type F = typeof linkFields;
type Ready = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
function LinkDetailControls({ centerId }: { centerId: string }) {
  const [link, setLink] = useState<FounderStaffLink | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingNotice, setSavingNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void readFounderStaffLink(centerId, fetch, controller.signal)
      .then(value => { if (!controller.signal.aborted) setLink(value); })
      .catch(() => { if (!controller.signal.aborted) setError("Không tải được trạng thái link đăng ký."); });
    return () => controller.abort();
  }, [centerId]);
  async function setEnabled(): Promise<void> {
    if (!link || busy) return;
    setBusy(true); setError(""); setSavingNotice("");
    try {
      const response = await fetch("/api/ho/staff-center-links/" + centerId + "/status", {
        method: "POST", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ enabled: !link.enabled, expectedVersion: link.version }),
      });
      if (!response.ok) throw Error(response.status === 409
        ? "Trạng thái link đã thay đổi. Hãy tải lại."
        : response.status === 403 ? "Không có quyền thay đổi link." : "Không lưu được trạng thái link.");
      // Read back independently from Core after the atomic write.
      const latest = await readFounderStaffLink(centerId, fetch);
      if (latest.enabled === link.enabled || latest.version <= link.version) throw Error("Chưa xác minh được thay đổi.");
      setLink(latest);
      setSavingNotice(latest.enabled ? "Đã bật nhận hồ sơ." : "Đã tắt nhận hồ sơ.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được link.");
    } finally { setBusy(false); }
  }
  return <section aria-label="Trạng thái link đăng ký" className="property-section">
    <h3>Nhận hồ sơ</h3>
    {error ? <p role="alert">{error}</p> : null}
    {!link && !error ? <p role="status">Đang đọc trạng thái link…</p> : null}
    {link ? <>
      <p role="status">{link.enabled ? "Đang bật nhận hồ sơ" : "Tạm tắt nhận hồ sơ"}</p>
      <div className="property-row">
        <TosButton type="button" variant="secondary" disabled={busy} onClick={() => void setEnabled()}>
          {busy ? "Đang lưu…" : link.enabled ? "Tắt nhận hồ sơ" : "Bật nhận hồ sơ"}
        </TosButton>
        {/* Do not expose a nonfunctional public URL before Center-token intake exists. */}
        <TosButton type="button" variant="secondary" disabled>Sao chép link</TosButton>
      </div>
      <p role="status">Link chia sẻ chưa khả dụng khi cổng đăng ký theo cơ sở chưa mở.</p>
      {savingNotice ? <p role="status">{savingNotice}</p> : null}
    </> : null}
  </section>;
}
export function HoStaffLinksTdd() {
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let adapter: AuthenticatedSurfaceAdapter<F> | null = null;
    void createHoTddAdapter({ registry: new TddRegistry(), definition: linkDefinition, provider: linkProvider }, controller.signal)
      .then(value => {
        adapter = value;
        if (controller.signal.aborted) { value.dispose(); return; }
        setReady({ adapter: value, navigation: browserTddNavigation("HO", "staffLinks", linkQuery) });
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); adapter?.dispose(); };
  }, [retry]);
  const content = error
    ? <p role="alert">Không tải được Link đăng ký Staff. <button type="button" onClick={() => { setError(false); setReady(null); setRetry(v => v + 1); }}>Thử lại</button></p>
    : ready ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={linkQuery}
      detailOverview={record => <LinkDetailControls centerId={record.id} />} />
      : <p role="status">Đang tải Link đăng ký Staff…</p>;
  return <HoWorkspace module="staffLinks" content={content} />;
}
