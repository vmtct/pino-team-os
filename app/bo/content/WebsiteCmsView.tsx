"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoApiError } from "@/lib/bo-api-error";
import { boWebCmsApi } from "@/lib/bo-web-cms-api";
import { BO_WEB_CMS_SITES, type BoWebCmsLocale, type BoWebCmsRevision, type BoWebCmsSite, type BoWebCmsSlotDetail, type BoWebCmsSlotSummary, type BoWebCmsValue } from "@/lib/bo-web-cms-model";
import styles from "./website-cms.module.css";

type EditorValue = { vi: string; en: string; mediaAssetId: string; altVi: string; altEn: string };
const emptyEditor: EditorValue = { vi: "", en: "", mediaAssetId: "", altVi: "", altEn: "" };

function toEditor(value?: BoWebCmsValue | null): EditorValue {
  if (!value) return emptyEditor;
  return value.type === "TEXT"
    ? { ...emptyEditor, vi: value.values.vi ?? "", en: value.values.en ?? "" }
    : { ...emptyEditor, mediaAssetId: value.mediaAssetId, altVi: value.alt.vi, altEn: value.alt.en };
}

function valueFor(slot: BoWebCmsSlotDetail, editor: EditorValue): BoWebCmsValue {
  return slot.kind === "IMAGE"
    ? { type: "IMAGE", mediaAssetId: editor.mediaAssetId.trim(), alt: { vi: editor.altVi.trim(), en: editor.altEn.trim() } }
    : { type: "TEXT", values: { vi: editor.vi.trim() || null, en: editor.en.trim() || null } };
}

function sameValue(left: BoWebCmsValue, right: BoWebCmsValue) { return JSON.stringify(left) === JSON.stringify(right); }

function errorMessage(error: unknown) {
  if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · request ${error.requestId}` : ""}`;
  return error instanceof Error ? error.message : "Website CMS operation failed.";
}

export function WebsiteCmsView() {
  const [site, setSite] = useState<BoWebCmsSite>("PINOHOUSE");
  const [slots, setSlots] = useState<BoWebCmsSlotSummary[]>([]);
  const [selected, setSelected] = useState<BoWebCmsSlotDetail | null>(null);
  const [history, setHistory] = useState<BoWebCmsRevision[]>([]);
  const [editor, setEditor] = useState<EditorValue>(emptyEditor);
  const [locale, setLocale] = useState<BoWebCmsLocale>("vi");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<BoWebCmsRevision | null>(null);
  const replayKeys = useRef(new Map<string, string>());

  const pages = useMemo(() => Array.from(new Set(slots.map(slot => slot.page))), [slots]);
  const editorValue = selected ? valueFor(selected, editor) : null;
  const hasUnsavedChanges = Boolean(selected && editorValue && !sameValue(editorValue, selected.draft?.value ?? selected.published?.value ?? selected.sourceFallback));

  useEffect(() => { void loadSite(site); }, [site]);

  async function loadSite(nextSite: BoWebCmsSite) {
    setLoading(true); setError(""); setNotice(""); setSelected(null); setHistory([]);
    try { setSlots(await boWebCmsApi.slots(nextSite)); }
    catch (cause) { setError(errorMessage(cause)); setSlots([]); }
    finally { setLoading(false); }
  }

  async function chooseSlot(slotId: string) {
    setBusy("load"); setError(""); setNotice("");
    try {
      const [detail, revisions] = await Promise.all([boWebCmsApi.detail(slotId), boWebCmsApi.history(slotId)]);
      setSelected(detail); setHistory(revisions); setEditor(toEditor(detail.draft?.value ?? detail.published?.value ?? detail.sourceFallback));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function refresh(slotId: string) {
    const [detail, revisions, nextSlots] = await Promise.all([boWebCmsApi.detail(slotId), boWebCmsApi.history(slotId), boWebCmsApi.slots(site)]);
    setSelected(detail); setHistory(revisions); setSlots(nextSlots); setEditor(toEditor(detail.draft?.value ?? detail.published?.value ?? detail.sourceFallback));
  }

  function replayKey(signature: string) {
    const existing = replayKeys.current.get(signature); if (existing) return existing;
    const created = crypto.randomUUID(); replayKeys.current.set(signature, created); return created;
  }

  function validate(): string | null {
    if (!selected) return "Select a registered slot first.";
    if (selected.kind === "IMAGE" && (!editor.mediaAssetId.trim() || !editor.altVi.trim() || !editor.altEn.trim())) return "Canonical media asset ID and VI/EN alt text are required.";
    if (selected.kind !== "IMAGE" && !editor.vi.trim() && !editor.en.trim()) return "Enter content for at least one locale.";
    return null;
  }

  async function saveDraft() {
    const invalid = validate(); if (invalid || !selected) return setError(invalid ?? "Invalid draft.");
    setBusy("save"); setError(""); setNotice("");
    const value = valueFor(selected, editor); const signature = `save:${selected.id}:${selected.currentRevision}:${JSON.stringify(value)}`;
    try { await boWebCmsApi.saveDraft(selected.id, selected.currentRevision, value, replayKey(signature)); replayKeys.current.delete(signature); await refresh(selected.id); setNotice("Draft saved. Public websites are unchanged."); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function publish() {
    if (!selected) return;
    setBusy("publish"); setError("");
    const signature = `publish:${selected.id}:${selected.currentRevision}:${selected.draft?.id ?? "none"}`;
    try { await boWebCmsApi.publish(selected.id, selected.currentRevision, replayKey(signature)); replayKeys.current.delete(signature); await refresh(selected.id); setNotice("Published as a new immutable revision."); setPublishOpen(false); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function rollback() {
    if (!selected || !rollbackTarget) return;
    setBusy("rollback"); setError("");
    const signature = `rollback:${selected.id}:${selected.currentRevision}:${rollbackTarget.id}`;
    try { await boWebCmsApi.rollback(selected.id, selected.currentRevision, rollbackTarget.id, replayKey(signature)); replayKeys.current.delete(signature); await refresh(selected.id); setNotice(`Rolled back through a new published revision based on r${rollbackTarget.revision}.`); setRollbackTarget(null); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span>Content · PLT-WEB-CMS / F1-BO</span><h1>Website CMS</h1><p>Editorial copy and canonical public media only. Core owns permissions, revisions, publication, and audit.</p></div>
      <div className={styles.sites} aria-label="Website selector">{BO_WEB_CMS_SITES.map(item => <button key={item.id} className={site === item.id ? styles.siteActive : ""} disabled={!!busy} onClick={() => setSite(item.id)}>{item.label}</button>)}</div>
    </header>
    {error ? <div className={styles.error}><strong>Could not complete the operation</strong><span>{error}</span></div> : null}
    {notice ? <div className={styles.notice}>{notice}</div> : null}
    <div className={styles.workspace}>
      <aside className={styles.registry}>
        <div className={styles.panelTitle}><div><span>REGISTERED CONTENT</span><strong>{BO_WEB_CMS_SITES.find(item => item.id === site)?.label}</strong></div><b>{slots.length}</b></div>
        {loading ? <p className={styles.empty}>Loading registered slots…</p> : pages.length ? pages.map(page => <section className={styles.pageGroup} key={page}><h2>{page}</h2>{slots.filter(slot => slot.page === page).map(slot => <button key={slot.id} disabled={!!busy} className={selected?.id === slot.id ? styles.slotActive : ""} onClick={() => void chooseSlot(slot.id)}><span><strong>{slot.key}</strong><small>{slot.kind.replaceAll("_", " ")}</small></span><i>{slot.draftRevisionId ? "DRAFT" : slot.publishedRevisionId ? "LIVE" : "FALLBACK"}</i></button>)}</section>) : <p className={styles.empty}>No active manifest slots are registered for this site.</p>}
      </aside>
      <main className={styles.editor}>
        {!selected ? <div className={styles.welcome}><span>CMS</span><h2>Select a page slot</h2><p>Choose a manifest-registered slot to compare its draft and published revision.</p></div> : <>
          <div className={styles.editorHead}><div><span>{selected.page}</span><h2>{selected.key}</h2><small>{selected.kind} · revision {selected.currentRevision} · {selected.status}</small></div><div className={styles.locales}><button className={locale === "vi" ? styles.localeActive : ""} onClick={() => setLocale("vi")}>VI</button><button className={locale === "en" ? styles.localeActive : ""} onClick={() => setLocale("en")}>EN</button></div></div>
          <section className={styles.comparison}>
            <ValueCard title="Published" badge={selected.published ? `r${selected.published.revision}` : "SOURCE FALLBACK"} value={selected.published?.value ?? selected.sourceFallback} locale={locale} />
            <ValueCard title={hasUnsavedChanges ? "Editor preview" : "Current draft"} badge={hasUnsavedChanges ? "UNSAVED CHANGES" : selected.draft ? `r${selected.draft.revision}` : "UNSAVED"} value={editorValue!} locale={locale} draft />
          </section>
          <section className={styles.form}>
            <div className={styles.formTitle}><div><span>EDITOR</span><strong>{selected.kind === "IMAGE" ? "Canonical image reference" : `${locale.toUpperCase()} content`}</strong></div><span className={styles.safeChip}>No URLs · No layout</span></div>
            {selected.kind === "IMAGE" ? <>
              <label>Canonical media asset ID<input value={editor.mediaAssetId} onChange={event => setEditor(current => ({ ...current, mediaAssetId: event.target.value }))} placeholder="UUID from Media library" /></label>
              <button className={styles.libraryPlaceholder} type="button" disabled title="Media library integration is not part of F1-BO">Browse canonical media library <small>Integration placeholder</small></button>
              <div className={styles.twoCol}><label>Alt text · VI<input value={editor.altVi} onChange={event => setEditor(current => ({ ...current, altVi: event.target.value }))} /></label><label>Alt text · EN<input value={editor.altEn} onChange={event => setEditor(current => ({ ...current, altEn: event.target.value }))} /></label></div>
            </> : <div className={styles.twoCol}><label>Nội dung · VI<textarea rows={6} value={editor.vi} onChange={event => setEditor(current => ({ ...current, vi: event.target.value }))} /></label><label>Content · EN<textarea rows={6} value={editor.en} onChange={event => setEditor(current => ({ ...current, en: event.target.value }))} /></label></div>}
          </section>
          <section className={styles.history}><div className={styles.formTitle}><div><span>HISTORY</span><strong>Immutable revisions</strong></div></div>{history.length ? history.map(revision => <article key={revision.id}><div><strong>r{revision.revision} · {revision.state}</strong><small>{new Date(revision.publishedAt ?? revision.createdAt).toLocaleString("vi-VN")}{revision.rollbackSourceRevisionId ? " · rollback" : ""}</small></div>{revision.state === "PUBLISHED" && revision.id !== selected.publishedRevisionId ? <button disabled={!!busy} onClick={() => setRollbackTarget(revision)}>Roll back to this</button> : null}</article>) : <p className={styles.empty}>No revision history yet.</p>}</section>
          <footer className={styles.actions}><span>{hasUnsavedChanges ? "Save Draft before publishing. Unsaved editor changes are never published." : `Writes use expected revision ${selected.currentRevision}; stale changes fail closed.`}</span><div><button disabled={!!busy} onClick={() => void saveDraft()}>{busy === "save" ? "Saving…" : "Save Draft"}</button><button className={styles.primary} disabled={!!busy || !selected.draft || hasUnsavedChanges} title={hasUnsavedChanges ? "Save Draft before publishing" : undefined} onClick={() => setPublishOpen(true)}>Publish</button></div></footer>
        </>}
      </main>
    </div>
    {publishOpen && selected ? <Confirm title="Publish this draft?" body="This creates a new immutable published revision for this slot. Public consumers may read it after their separately governed cutover." confirm="Publish revision" busy={busy === "publish"} onCancel={() => setPublishOpen(false)} onConfirm={() => void publish()} /> : null}
    {rollbackTarget ? <Confirm title={`Roll back to r${rollbackTarget.revision}?`} body="Rollback does not rewrite history. Core creates a new published revision reproducing the selected value." confirm="Create rollback revision" busy={busy === "rollback"} onCancel={() => setRollbackTarget(null)} onConfirm={() => void rollback()} /> : null}
  </div>;
}

function ValueCard({ title, badge, value, locale, draft }: { title: string; badge: string; value: BoWebCmsValue; locale: BoWebCmsLocale; draft?: boolean }) {
  return <article className={`${styles.valueCard} ${draft ? styles.draftCard : ""}`}><header><strong>{title}</strong><span>{badge}</span></header>{value.type === "IMAGE" ? <div className={styles.imagePreview}><div className={styles.thumbnail} aria-label={`${title} thumbnail`}><span>MEDIA</span><strong>{value.mediaAssetId || "No asset selected"}</strong></div><p>{value.alt[locale] || `No ${locale.toUpperCase()} alt text`}</p></div> : <p className={styles.copyPreview}>{value.values[locale] || `No ${locale.toUpperCase()} value`}</p>}</article>;
}

function Confirm({ title, body, confirm, busy, onCancel, onConfirm }: { title: string; body: string; confirm: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onCancel}><section className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={event => event.stopPropagation()}><span>CONFIRMATION</span><h2 id="confirm-title">{title}</h2><p>{body}</p><div><button disabled={busy} onClick={onCancel}>Cancel</button><button className={styles.primary} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirm}</button></div></section></div>;
}
