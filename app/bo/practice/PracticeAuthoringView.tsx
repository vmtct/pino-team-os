"use client";
/* User-selected draft previews may use blob/protected URLs; Next image optimization is not applicable here. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import bo from "../bo.module.css";
import styles from "./practice.module.css";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoPathProgram } from "@/lib/bo-model";
import {
  PIANO_PRACTICE_FORMAT_V1,
  type BoPracticeFamily,
  type BoPracticePage,
  type BoPracticeResourceDetail,
  type BoPracticeResourceSummary,
} from "@/lib/bo-practice-model";

type PageForm = {
  id?: string;
  sheetMediaRef: string;
  worksheetMediaRef: string | null;
  sheetPreviewUrl?: string | null;
  worksheetPreviewUrl?: string | null;
  sheetName?: string;
  worksheetName?: string;
};

type FormState = {
  title: string;
  family: BoPracticeFamily;
  pathId: string;
  contextKey: string;
  expectedRevision: number;
  pages: PageForm[];
};
const blankPage = (): PageForm => ({ sheetMediaRef: "", worksheetMediaRef: null });
const blankForm = (): FormState => ({
  title: "",
  family: "JOURNEY",
  pathId: "",
  contextKey: "",
  expectedRevision: 0,
  pages: [blankPage()],
});

function pagesFromDetail(detail: BoPracticeResourceDetail): PageForm[] {
  const pages = detail.draft?.pages ?? detail.currentPublished?.pages ?? [];
  return pages.length ? [...pages].sort((a, b) => a.order - b.order).map(pageToForm) : [blankPage()];
}

function pageToForm(page: BoPracticePage): PageForm {
  return {
    id: page.id,
    sheetMediaRef: page.sheetMediaRef,
    worksheetMediaRef: page.worksheetMediaRef,
    sheetPreviewUrl: page.sheetPreviewUrl,
    worksheetPreviewUrl: page.worksheetPreviewUrl,
  };
}

function formFromDetail(detail: BoPracticeResourceDetail): FormState {
  return {
    title: detail.title,
    family: detail.family,
    pathId: detail.pathId ?? "",
    contextKey: detail.contextKey ?? "",
    expectedRevision: detail.draft?.revision ?? 0,
    pages: pagesFromDetail(detail),
  };
}
export function PracticeAuthoringView() {
  const [resources, setResources] = useState<BoPracticeResourceSummary[]>([]);
  const [paths, setPaths] = useState<BoPathProgram[]>([]);
  const [selected, setSelected] = useState<BoPracticeResourceDetail | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadLibrary(preferredId?: string) {
    const [nextResources, nextPaths] = await Promise.all([boApi.practiceResources(), boApi.pathPrograms()]);
    setResources(nextResources);
    setPaths(nextPaths);
    if (preferredId) await selectResource(preferredId, nextResources);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([boApi.practiceResources(), boApi.pathPrograms()])
      .then(([nextResources, nextPaths]) => {
        if (!active) return;
        setResources(nextResources);
        setPaths(nextPaths);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Practice library could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function selectResource(resourceId: string, known = resources) {
    setBusy("loading");
    setError("");
    try {
      const detail = await boApi.practiceResource(resourceId);
      setSelected(detail);
      setForm(formFromDetail(detail));
      setCreating(false);
      setPreviewing(false);
      if (!known.some(item => item.id === resourceId)) setResources(await boApi.practiceResources());
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }
  function startCreate() {
    setSelected(null);
    setForm(blankForm());
    setCreating(true);
    setPreviewing(false);
    setError("");
    setMessage("");
  }

  async function createResource() {
    if (!form.title.trim()) return setError("Tên Practice Resource là bắt buộc.");
    setBusy("create");
    setError("");
    try {
      const detail = await boApi.createPracticeResource({
        title: form.title.trim(),
        family: form.family,
        pathId: form.pathId || null,
        contextKey: form.contextKey.trim() || null,
        formatDefinitionKey: PIANO_PRACTICE_FORMAT_V1,
      });
      setMessage("Đã tạo draft. Bây giờ có thể thêm Sheet / Worksheet.");
      await loadLibrary(detail.id);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  function patchPage(index: number, patch: Partial<PageForm>) {
    setForm(current => ({
      ...current,
      pages: current.pages.map((page, pageIndex) => pageIndex === index ? { ...page, ...patch } : page),
    }));
  }

  function addPage() {
    setForm(current => ({ ...current, pages: [...current.pages, blankPage()] }));
  }
  function removePage(index: number) {
    setForm(current => ({ ...current, pages: current.pages.filter((_, pageIndex) => pageIndex !== index) }));
  }

  function movePage(index: number, direction: -1 | 1) {
    setForm(current => {
      const target = index + direction;
      if (target < 0 || target >= current.pages.length) return current;
      const pages = [...current.pages];
      [pages[index], pages[target]] = [pages[target]!, pages[index]!];
      return { ...current, pages };
    });
  }

  async function upload(index: number, kind: "sheet" | "worksheet", file: File) {
    setBusy(`upload-${index}-${kind}`);
    setError("");
    try {
      const media = await boApi.uploadPracticeMedia(file);
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : (media.previewUrl ?? null);
      patchPage(index, kind === "sheet"
        ? { sheetMediaRef: media.mediaRef, sheetPreviewUrl: previewUrl, sheetName: file.name }
        : { worksheetMediaRef: media.mediaRef, worksheetPreviewUrl: previewUrl, worksheetName: file.name });
      setMessage(`${kind === "sheet" ? "Sheet" : "Worksheet"} đã được ingest và trả về mediaRef.`);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  function validateDraft(): string | null {
    if (!form.title.trim()) return "Tên Practice Resource là bắt buộc.";
    if (form.pages.length < 1) return "Practice Resource phải có ít nhất một page.";
    if (form.pages.some(page => !page.sheetMediaRef.trim())) return "Mỗi page phải có Sheet trước khi lưu/publish.";
    return null;
  }
  async function saveDraft() {
    if (!selected) return;
    const validation = validateDraft();
    if (validation) return setError(validation);
    setBusy("save");
    setError("");
    try {
      const detail = await boApi.savePracticeDraft(selected.id, {
        title: form.title.trim(),
        family: form.family,
        pathId: form.pathId || null,
        contextKey: form.contextKey.trim() || null,
        formatDefinitionKey: PIANO_PRACTICE_FORMAT_V1,
        expectedRevision: form.expectedRevision,
        pages: form.pages.map((page, index) => ({
          ...(page.id ? { id: page.id } : {}),
          order: index + 1,
          sheetMediaRef: page.sheetMediaRef,
          worksheetMediaRef: page.worksheetMediaRef || null,
        })),
      });
      setSelected(detail);
      setForm(formFromDetail(detail));
      setMessage("Draft đã lưu theo revision mới nhất.");
      setResources(await boApi.practiceResources());
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  async function publish() {
    if (!selected) return;
    const validation = validateDraft();
    if (validation) return setError(validation);
    setBusy("publish");
    setError("");
    try {
      const detail = await boApi.publishPracticeResource(selected.id, form.expectedRevision);
      setSelected(detail);
      setForm(formFromDetail(detail));
      setMessage(`Published v${detail.publishedVersion ?? detail.currentPublished?.version ?? "?"}. Phiên bản đã publish là immutable.`);
      setResources(await boApi.practiceResources());
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }
  function showError(cause: unknown) {
    if (cause instanceof BoApiError) {
      setError(`${cause.message}${cause.requestId ? ` · request ${cause.requestId}` : ""}`);
      return;
    }
    setError(cause instanceof Error ? cause.message : "Practice operation failed.");
  }

  if (loading) return <main className={`${bo.page} ${styles.practicePage}`}><div className={bo.state}><strong>Đang tải Piano Practice…</strong></div></main>;

  return <main className={`${bo.page} ${styles.practicePage}`}>
    <header className={styles.header}>
      <div className={bo.heading}>
        <span>Learning · PSP-PIANO / F0</span>
        <h1>Piano Practice</h1>
        <p>BO authoring cho Practice Resource versioned. Core giữ identity, validation, permission, publication và media truth.</p>
      </div>
      <button className={bo.primaryButton} onClick={startCreate}>+ New Practice</button>
    </header>

    {error ? <div className={`${bo.card} ${bo.denied}`}><strong>Không thể hoàn tất</strong><span>{error}</span></div> : null}
    {message ? <div className={bo.successCard}><span>Practice</span><strong>{message}</strong></div> : null}

    <div className={styles.workspace}>
      <aside className={styles.library}>
        <div className={styles.libraryHead}><strong>Practice library</strong><span>{resources.length}</span></div>
        {resources.length === 0 ? <small>Chưa có Practice Resource.</small> : resources.map(resource => (
          <button key={resource.id} className={`${styles.resourceButton} ${selected?.id === resource.id ? styles.resourceActive : ""}`} onClick={() => void selectResource(resource.id)}>
            <strong>{resource.title}</strong>
            <span>{resource.family} · {resource.lifecycle}</span>
            <small>draft {resource.draftVersion ?? "—"} · published {resource.publishedVersion ?? "—"}</small>
          </button>
        ))}
      </aside>
      <section className={styles.editor}>
        {!creating && !selected ? <div className={bo.empty}>Chọn một Practice hoặc tạo mới.</div> : (
          <>
            <div className={styles.editorHead}>
              <div>
                <span className={bo.status}>{creating ? "NEW DRAFT" : selected?.lifecycle}</span>
                <h2>{creating ? "Create Practice Resource" : selected?.title}</h2>
                {!creating && selected ? <small>resource {selected.id} · revision {form.expectedRevision}</small> : null}
              </div>
              {!creating && selected ? <button className={bo.secondaryButton} onClick={() => setPreviewing(value => !value)}>{previewing ? "Edit draft" : "Preview draft"}</button> : null}
            </div>

            <div className={styles.metaGrid}>
              <label className={bo.field}>Tên Practice
                <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Always With Me" />
              </label>
              <label className={bo.field}>Family
                <select value={form.family} onChange={event => setForm(current => ({ ...current, family: event.target.value as BoPracticeFamily }))}>
                  <option value="STARTER">Khởi Hành</option><option value="JOURNEY">Hành Trình</option><option value="SPECIALTY">Chuyên Đề</option>
                </select>
              </label>
              <label className={bo.field}>Path
                <select value={form.pathId} onChange={event => setForm(current => ({ ...current, pathId: event.target.value }))}>
                  <option value="">Global / chưa map Path</option>{paths.map(path => <option key={path.id} value={path.id}>{path.displayName}</option>)}
                </select>
              </label>
              <label className={bo.field}>Context key
                <input value={form.contextKey} onChange={event => setForm(current => ({ ...current, contextKey: event.target.value }))} placeholder="piece / specialty context" />
              </label>
            </div>
            {creating ? (
              <div className={styles.createGate}>
                <div><strong>Tạo resource trước khi attach media</strong><span>Giữ media ingestion gắn với một canonical draft, không dùng local persistence.</span></div>
                <button className={bo.primaryButton} disabled={!!busy} onClick={() => void createResource()}>{busy === "create" ? "Đang tạo…" : "Create draft"}</button>
              </div>
            ) : previewing ? (
              <DraftPreview title={form.title} pages={form.pages} />
            ) : (
              <div className={styles.pageStack}>
                <div className={styles.pageStackHead}>
                  <div><strong>Ordered pages</strong><span>Sheet bắt buộc · Worksheet tùy chọn</span></div>
                  <button className={bo.secondaryButton} onClick={addPage}>+ Add page</button>
                </div>
                {form.pages.map((page, index) => (
                  <article className={styles.pageCard} key={page.id ?? `new-${index}`}>
                    <div className={styles.pageTop}>
                      <div><span>Page {index + 1}</span><small>{page.id ?? "new page"}</small></div>
                      <div className={styles.pageActions}>
                        <button className={bo.secondaryButton} disabled={index === 0} onClick={() => movePage(index, -1)}>↑</button>
                        <button className={bo.secondaryButton} disabled={index === form.pages.length - 1} onClick={() => movePage(index, 1)}>↓</button>
                        <button className={styles.removeButton} disabled={form.pages.length === 1} onClick={() => removePage(index)}>Remove</button>
                      </div>
                    </div>

                    <div className={styles.mediaGrid}>
                      <MediaSlot label="Sheet" required mediaRef={page.sheetMediaRef} fileName={page.sheetName} previewUrl={page.sheetPreviewUrl}
                        busy={busy === `upload-${index}-sheet`} onFile={file => void upload(index, "sheet", file)} />
                      <MediaSlot label="Worksheet" mediaRef={page.worksheetMediaRef ?? ""} fileName={page.worksheetName} previewUrl={page.worksheetPreviewUrl}
                        busy={busy === `upload-${index}-worksheet`} onFile={file => void upload(index, "worksheet", file)}
                        onRemove={() => patchPage(index, { worksheetMediaRef: null, worksheetPreviewUrl: null, worksheetName: undefined })} />
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!creating ? <div className={styles.publishBar}>
              <div><strong>{PIANO_PRACTICE_FORMAT_V1}</strong><span>Core re-validates page order, media refs and publish permission atomically.</span></div>
              <div>
                <button className={bo.secondaryButton} disabled={!!busy || previewing} onClick={() => void saveDraft()}>{busy === "save" ? "Saving…" : "Save draft"}</button>
                <button className={bo.primaryButton} disabled={!!busy || previewing || !selected?.draft} onClick={() => void publish()}>{busy === "publish" ? "Publishing…" : "Publish version"}</button>
              </div>
            </div> : null}
          </>
        )}
      </section>
    </div>
  </main>;
}

type MediaSlotProps = {
  label: string;
  required?: boolean;
  mediaRef: string;
  fileName?: string;
  previewUrl?: string | null;
  busy: boolean;
  onFile: (file: File) => void;
  onRemove?: () => void;
};

function MediaSlot({ label, required, mediaRef, fileName, previewUrl, busy, onFile, onRemove }: MediaSlotProps) {
  return <div className={styles.mediaSlot}>
    <div className={styles.mediaHead}><strong>{label}{required ? " *" : ""}</strong><span>{mediaRef ? "READY" : required ? "REQUIRED" : "OPTIONAL"}</span></div>
    {previewUrl ? <img className={styles.assetPreview} src={previewUrl} alt={`${label} preview`} /> : <div className={styles.assetEmpty}>{mediaRef ? "Media reference ready" : `No ${label}`}</div>}
    <small>{fileName ?? (mediaRef ? mediaRef : required ? "Upload required" : "Missing Worksheet is valid")}</small>
    <div className={styles.mediaActions}>
      <label className={bo.secondaryButton}>{busy ? "Uploading…" : mediaRef ? "Replace" : "Upload"}<input type="file" accept="image/*,application/pdf" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /></label>
      {onRemove && mediaRef ? <button className={styles.removeButton} disabled={busy} onClick={onRemove}>Remove Worksheet</button> : null}
    </div>
  </div>;
}

function DraftPreview({ title, pages }: { title: string; pages: PageForm[] }) {
  return <section className={styles.previewPanel}>
    <div><span className={bo.status}>DRAFT PREVIEW</span><h3>{title || "Untitled Practice"}</h3></div>
    <div className={styles.previewGrid}>
      {pages.map((page, index) => <article className={styles.previewPage} key={page.id ?? index}>
        <strong>Page {index + 1}</strong>
        <PreviewAsset label="Sheet" previewUrl={page.sheetPreviewUrl} mediaRef={page.sheetMediaRef} />
        {page.worksheetMediaRef ? <PreviewAsset label="Worksheet" previewUrl={page.worksheetPreviewUrl} mediaRef={page.worksheetMediaRef} /> : <div className={styles.noWorksheet}>No Worksheet published for this page</div>}
      </article>)}
    </div>
  </section>;
}

function PreviewAsset({ label, previewUrl, mediaRef }: { label: string; previewUrl?: string | null; mediaRef: string }) {
  return <div className={styles.previewAsset}>
    <span>{label}</span>
    {previewUrl ? <img src={previewUrl} alt={`${label} draft preview`} /> : <small>{mediaRef || "Missing media"}</small>}
  </div>;
}
