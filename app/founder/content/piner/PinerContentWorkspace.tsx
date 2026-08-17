"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PinerContentApiError,
  pinerContentApi,
  type PinerContentEntry,
  type PinerContentRegistry,
  type PinerContentRelease,
} from "@/lib/piner-content";
import styles from "./piner-content.module.css";

const SURFACES = [
  ["all", "Tất cả"],
  ["global", "Global"],
  ["home", "Trang chủ"],
  ["journey", "Hành trình"],
  ["collection", "Thành quả"],
  ["explore", "Khám Phá"],
  ["practice", "Practice"],
  ["household", "Household"],
  ["premium_compare", "Premium compare"],
] as const;

type SurfaceFilter = (typeof SURFACES)[number][0];

export default function PinerContentWorkspace() {
  const [registry, setRegistry] = useState<PinerContentRegistry | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [surface, setSurface] = useState<SurfaceFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await pinerContentApi.load();
      setRegistry(next);
      setEdits(Object.fromEntries(next.entries.map((entry) => [entry.key, entry.draftValue ?? entry.publishedValue])));
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => {
    if (!registry) return [];
    const needle = search.trim().toLocaleLowerCase("vi");
    return registry.entries.filter((entry) => {
      if (surface !== "all" && entry.surface !== surface) return false;
      if (!needle) return true;
      return [entry.key, entry.surface, entry.section, entry.publishedValue, entry.draftValue ?? ""]
        .some((value) => value.toLocaleLowerCase("vi").includes(needle));
    });
  }, [registry, search, surface]);

  const grouped = useMemo(() => {
    const map = new Map<string, PinerContentEntry[]>();
    entries.forEach((entry) => {
      const key = `${entry.surface} / ${entry.section}`;
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return [...map.entries()];
  }, [entries]);

  const draftCount = registry?.entries.filter((entry) => entry.hasDraft).length ?? 0;
  const localDirtyCount = registry?.entries.filter((entry) => (edits[entry.key] ?? entry.effectiveValue).trim() !== entry.effectiveValue).length ?? 0;
  const canPublish = Boolean(registry && !busy && (registry.release === null || draftCount > 0));

  async function saveDraft(entry: PinerContentEntry) {
    const value = (edits[entry.key] ?? entry.effectiveValue).trim();
    if (!value || busy) return;
    setBusy(`save:${entry.key}`);
    setError("");
    setNotice("");
    try {
      await pinerContentApi.saveDraft(entry.key, value);
      await load();
      setNotice(`Đã lưu bản nháp · ${entry.key}`);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    if (!registry || !canPublish) return;
    const label = registry.release ? `${draftCount} thay đổi` : "bản copy nền đầu tiên";
    if (!window.confirm(`Xuất bản ${label} cho Piner? Toàn bộ registry sẽ được chụp thành một release đồng bộ.`)) return;
    setBusy("publish");
    setError("");
    setNotice("");
    try {
      const result = await pinerContentApi.publish();
      await load();
      setNotice(`Đã xuất bản release #${result.release.releaseNumber}.`);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy("");
    }
  }

  async function rollback(release: PinerContentRelease) {
    if (!registry || busy || release.id === registry.release?.id) return;
    if (!window.confirm(`Khôi phục nội dung từ release #${release.releaseNumber}? Hệ thống sẽ tạo một release mới, không ghi đè lịch sử.`)) return;
    setBusy(`rollback:${release.id}`);
    setError("");
    setNotice("");
    try {
      const result = await pinerContentApi.rollback(release.id);
      await load();
      setNotice(`Đã khôi phục release #${release.releaseNumber} thành release mới #${result.release.releaseNumber}.`);
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setBusy("");
    }
  }

  if (loading && !registry) return <Loading />;
  if (!registry) return <Failure error={error || "Không thể tải Piner Content."} retry={() => void load()} />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>PINO · FOUNDER · CONTENT</div>
          <h1>Piner Content</h1>
          <p>Copy learner/parent được quản lý theo semantic key. Save Draft không ảnh hưởng app cho đến khi Publish.</p>
        </div>
        <div className={styles.releaseCard}>
          <span>ĐANG XUẤT BẢN</span>
          <strong>{registry.release ? `Release #${registry.release.releaseNumber}` : "Chưa có release"}</strong>
          <small>{registry.release ? formatDate(registry.release.publishedAt) : "Runtime đang dùng fallback trong source"}</small>
        </div>
      </header>

      {error ? <div className={styles.alert} role="alert"><span>{error}</span><button onClick={() => setError("")}>Đóng</button></div> : null}
      {notice ? <div className={styles.notice}><span>{notice}</span><button onClick={() => setNotice("")}>Đóng</button></div> : null}

      <section className={styles.commandBar}>
        <div className={styles.searchWrap}>
          <label htmlFor="piner-content-search">Tìm copy</label>
          <input id="piner-content-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="key, nội dung, section…" />
        </div>
        <div className={styles.stats}>
          <span><b>{registry.entries.length}</b> keys</span>
          <span data-active={draftCount > 0}><b>{draftCount}</b> draft đã lưu</span>
          <span data-active={localDirtyCount > 0}><b>{localDirtyCount}</b> chưa lưu</span>
        </div>
        <button className={styles.publishButton} type="button" disabled={!canPublish} onClick={() => void publish()}>
          {busy === "publish" ? "Đang xuất bản…" : registry.release ? `Publish ${draftCount || ""}`.trim() : "Publish bản đầu tiên"}
        </button>
      </section>

      <nav className={styles.surfaceNav} aria-label="Lọc Piner content theo surface">
        {SURFACES.map(([key, label]) => (
          <button key={key} type="button" data-active={surface === key} onClick={() => setSurface(key)}>{label}</button>
        ))}
      </nav>

      <div className={styles.contentLayout}>
        <main className={styles.editorColumn}>
          {grouped.length ? grouped.map(([group, items]) => (
            <section className={styles.group} key={group}>
              <header className={styles.groupHeader}>
                <div><span>{surfaceLabel(items[0]?.surface ?? "")}</span><h2>{sectionLabel(items[0]?.section ?? "")}</h2></div>
                <small>{items.length} keys</small>
              </header>
              <div className={styles.entryList}>
                {items.map((entry) => (
                  <ContentRow
                    key={entry.key}
                    entry={entry}
                    value={edits[entry.key] ?? entry.effectiveValue}
                    busy={busy === `save:${entry.key}`}
                    onChange={(value) => setEdits((current) => ({ ...current, [entry.key]: value }))}
                    onSave={() => void saveDraft(entry)}
                  />
                ))}
              </div>
            </section>
          )) : <section className={styles.empty}><h2>Không có copy phù hợp</h2><p>Thử đổi surface hoặc từ khóa tìm kiếm.</p></section>}
        </main>

        <aside className={styles.history}>
          <div className={styles.historyHead}>
            <span>RELEASE HISTORY</span>
            <strong>Lịch sử xuất bản</strong>
            <p>Rollback luôn tạo release mới để lịch sử không bị viết lại.</p>
          </div>
          {registry.releases.length ? registry.releases.map((release) => {
            const current = release.id === registry.release?.id;
            return (
              <article key={release.id} className={styles.releaseRow} data-current={current}>
                <div><strong>#{release.releaseNumber}</strong><span>{current ? "Đang dùng" : formatDate(release.publishedAt)}</span></div>
                <small>{release.releaseKey}</small>
                <button type="button" disabled={current || Boolean(busy)} onClick={() => void rollback(release)}>
                  {busy === `rollback:${release.id}` ? "Đang khôi phục…" : current ? "Hiện tại" : "Khôi phục"}
                </button>
              </article>
            );
          }) : <p className={styles.historyEmpty}>Chưa có release. Copy runtime đang lấy từ fallback source-controlled.</p>}
        </aside>
      </div>
    </div>
  );
}

function ContentRow({ entry, value, busy, onChange, onSave }: {
  entry: PinerContentEntry;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const localDirty = value.trim() !== entry.effectiveValue;
  const placeholders = [...new Set(value.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g) ?? [])];
  const multiline = entry.type === "text" || entry.type === "rich_text" || value.length > 72;
  return (
    <article className={styles.entry} data-draft={entry.hasDraft || localDirty}>
      <header className={styles.entryHeader}>
        <div>
          <code>{entry.key}</code>
          <span>{entry.type}</span>
          {entry.hasDraft ? <em>Draft</em> : null}
          {localDirty ? <em data-local>Chưa lưu</em> : null}
        </div>
        {placeholders.length ? <small>Biến: {placeholders.join(" · ")}</small> : null}
      </header>

      <div className={styles.compare}>
        <div className={styles.publishedBox}>
          <label>Đã xuất bản</label>
          <p>{entry.publishedValue}</p>
        </div>
        <div className={styles.draftBox}>
          <label htmlFor={`copy-${entry.id}`}>Bản nháp</label>
          {multiline ? (
            <textarea id={`copy-${entry.id}`} rows={Math.min(6, Math.max(2, Math.ceil(value.length / 85)))} value={value} onChange={(event) => onChange(event.target.value)} />
          ) : (
            <input id={`copy-${entry.id}`} value={value} onChange={(event) => onChange(event.target.value)} />
          )}
          <div className={styles.draftActions}>
            <details>
              <summary>Fallback</summary>
              <p>{entry.fallbackValue}</p>
            </details>
            <button type="button" disabled={busy || !localDirty || !value.trim()} onClick={onSave}>{busy ? "Đang lưu…" : "Save Draft"}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Loading() {
  return <div className={styles.loading} aria-busy="true"><div /><div /><div /></div>;
}

function Failure({ error, retry }: { error: string; retry: () => void }) {
  return <section className={styles.failure}><span>PINO · FOUNDER · CONTENT</span><h1>Không thể tải Piner Content</h1><p>{error}</p><button onClick={retry}>Thử lại</button></section>;
}

function readError(cause: unknown) {
  if (cause instanceof PinerContentApiError) {
    if (cause.status === 401) return "Cần đăng nhập lại Cloudflare Access.";
    if (cause.status === 403) return "Tài khoản hiện tại không có quyền Founder.";
    return cause.message;
  }
  return cause instanceof Error ? cause.message : "Không thể hoàn tất yêu cầu.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function surfaceLabel(value: string) {
  return SURFACES.find(([key]) => key === value)?.[1] ?? value;
}

function sectionLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
