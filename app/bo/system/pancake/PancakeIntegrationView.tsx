"use client";

import { useEffect, useState } from "react";
import { boApi, type BoPancakeChannel, type BoPancakeSettings } from "@/lib/bo-api";
import styles from "./pancake.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; settings: BoPancakeSettings; channels: BoPancakeChannel[] };

export function PancakeIntegrationView() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [settings, channels] = await Promise.all([boApi.pancakeSettings(), boApi.pancakeChannels()]);
    setLoad({ state: "ready", settings, channels });
  }

  useEffect(() => {
    let active = true;
    Promise.all([boApi.pancakeSettings(), boApi.pancakeChannels()])
      .then(([settings, channels]) => { if (active) setLoad({ state: "ready", settings, channels }); })
      .catch((error: unknown) => { if (active) setLoad({ state: "error", message: message(error) }); });
    return () => { active = false; };
  }, []);

  async function toggleAutoDiscover() {
    if (load.state !== "ready" || busy) return;
    setBusy(true);
    try {
      await boApi.updatePancakeSettings({ autoDiscoverChannels: !load.settings.autoDiscoverChannels, expectedVersion: load.settings.version });
      await refresh();
    } catch (error) {
      setLoad({ state: "error", message: message(error) });
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><span>Integration · PLT-LEAD</span><h1>Pancake</h1><p>Channel dùng stable <code>page_id</code>. Chat routing dùng exact <code>conversation_link</code> Pancake cung cấp; không cần cấu hình locator.</p></div>
      <div className={styles.permission}>acquisition.lead.manage</div>
    </header>

    {load.state === "loading" ? <div className={styles.state}>Đang tải cấu hình Pancake…</div> : null}
    {load.state === "error" ? <div className={styles.error}>{load.message}<button type="button" onClick={() => { setLoad({ state: "loading" }); void refresh().catch((error) => setLoad({ state: "error", message: message(error) })); }}>Thử lại</button></div> : null}
    {load.state === "ready" ? <>
      <section className={styles.setting}>
        <div><strong>Tự động phát hiện channel mới</strong><p>Event đáng tin cậy có <code>page_id</code> mới sẽ tạo Channel record tự động. Tắt để fail closed cho channel chưa cấu hình.</p></div>
        <button type="button" className={load.settings.autoDiscoverChannels ? styles.on : styles.off} disabled={busy} onClick={() => void toggleAutoDiscover()}>
          {load.settings.autoDiscoverChannels ? "Đang bật" : "Đang tắt"}
        </button>
      </section>

      <section className={styles.channels}>
        <div className={styles.sectionHead}><div><strong>Channels</strong><span>{load.channels.length}</span></div><p>Channel ID là provider identity bất biến; chỉ tên hiển thị và trạng thái vận hành được chỉnh.</p></div>
        {load.channels.length === 0 ? <div className={styles.state}>Chưa có Pancake Channel nào được materialize.</div> : null}
        {load.channels.map((channel) => <ChannelEditor key={channel.id} channel={channel} onSaved={refresh} />)}
      </section>
    </> : null}
  </main>;
}

function ChannelEditor({ channel, onSaved }: { channel: BoPancakeChannel; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(channel.displayName);
  const [enabled, setEnabled] = useState(channel.enabled);
  const [busy, setBusy] = useState(false);
  const changed = displayName.trim() !== channel.displayName || enabled !== channel.enabled;

  async function save() {
    if (!changed || !displayName.trim() || busy) return;
    setBusy(true);
    try {
      await boApi.configurePancakeChannel(channel.id, { displayName: displayName.trim(), enabled, expectedVersion: channel.version });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return <article className={styles.channel}>
    <div className={styles.channelMeta}>
      <div><span>{channel.channel}</span><strong>{channel.displayName}</strong></div>
      <small>{channel.discoveredBy === "PANCAKE_EVENT" ? "Auto-discovered" : "Manual"}</small>
    </div>
    <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
    <div className={styles.readonly}><span>Channel ID</span><code>{channel.providerPageId}</code></div>
    <label className={styles.checkbox}><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
    <button type="button" disabled={!changed || !displayName.trim() || busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu"}</button>
  </article>;
}

function message(error: unknown) { return error instanceof Error ? error.message : "Không thể tải cấu hình Pancake."; }
