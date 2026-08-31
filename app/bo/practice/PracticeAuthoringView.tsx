"use client";
/* User-selected draft previews may use blob URLs; Next image optimization is not applicable here. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import bo from "../bo.module.css";
import styles from "./practice.module.css";
import { boApi, BoApiError } from "@/lib/bo-api";
import {
  PIANO_PRACTICE_FORMAT_V1,
  type BoPracticeAuthoringContext,
  type BoPracticeCatalogItem,
  type BoPracticeFamily,
  type BoPracticePage,
  type BoPracticeResourceDetail,
  type BoPracticeResourceVersion,
} from "@/lib/bo-practice-model";

type PageForm = {
  id?: string;
  sheetMediaAssetId: string;
  worksheetMediaAssetId: string | null;
  sheetPreviewUrl?: string | null;
  worksheetPreviewUrl?: string | null;
  sheetName?: string;
  worksheetName?: string;
};
type FormState = {
  title: string;
  family: BoPracticeFamily;
  pathProgramId: string;
  pianoRepertoireItemId: string;
  pages: PageForm[];
};
type ReplayKey = { signature: string; key: string };

const blankPage = (): PageForm => ({ sheetMediaAssetId: "", worksheetMediaAssetId: null });
const classForFamily = (family: BoPracticeFamily) => family === "STARTER" ? "KHOI_HANH" : family === "JOURNEY" ? "HANH_TRINH" : "CHUYEN_DE";

function pageToForm(page: BoPracticePage): PageForm {
  return { id: page.id, sheetMediaAssetId: page.sheetMediaAssetId, worksheetMediaAssetId: page.worksheetMediaAssetId };
}
function formFromDetail(detail: BoPracticeResourceDetail): FormState {
  const version = detail.draft ?? detail.currentPublished;
  return {
    title: version?.title ?? detail.title,
    family: detail.family,
    pathProgramId: detail.pathProgramId,
    pianoRepertoireItemId: detail.pianoRepertoireItemId,
    pages: version?.pages.length ? [...version.pages].sort((a, b) => a.order - b.order).map(pageToForm) : [blankPage()],
  };
}
function blankForm(context: BoPracticeAuthoringContext | null, pathProgramId = "", family: BoPracticeFamily = "JOURNEY"): FormState {
  const path = context?.paths.find(item => item.id === pathProgramId) ?? context?.paths[0];
  const item = path?.repertoireItems.find(candidate => candidate.repertoireClass === classForFamily(family));
  return { title: "", family, pathProgramId: path?.id ?? "", pianoRepertoireItemId: item?.id ?? "", pages: [blankPage()] };
}

export function PracticeAuthoringView() {
  const [context, setContext] = useState<BoPracticeAuthoringContext | null>(null);
  const [activePathId, setActivePathId] = useState("");
  const [resources, setResources] = useState<BoPracticeResourceDetail[]>([]);
  const [selected, setSelected] = useState<BoPracticeResourceDetail | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(null));
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const createReplay = useRef<ReplayKey | null>(null);
  const uploadReplay = useRef<Record<string, ReplayKey>>({});

  useEffect(() => {
    let active = true;
    void boApi.practiceAuthoringContext()
      .then(async nextContext => {
        if (!active) return;
        setContext(nextContext);
        const pathId = nextContext.paths[0]?.id ?? "";
        setActivePathId(pathId);
        setForm(blankForm(nextContext, pathId));
        if (pathId) setResources(await boApi.practiceResources(pathId));
      })
      .catch(cause => { if (active) showError(cause); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePath(pathProgramId: string) {
    setActivePathId(pathProgramId);
    setSelected(null);
    setCreating(false);
    setPreviewing(false);
    setError("");
    setResources(pathProgramId ? await boApi.practiceResources(pathProgramId) : []);
  }

  async function refreshLibrary(pathProgramId = activePathId) {
    if (pathProgramId) setResources(await boApi.practiceResources(pathProgramId));
  }

  async function selectResource(resourceId: string) {
    setBusy("loading");
    setError("");
    try {
      const detail = await boApi.practiceResource(resourceId);
      setSelected(detail);
      setActivePathId(detail.pathProgramId);
      setForm(formFromDetail(detail));
      setCreating(false);
      setPreviewing(false);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  function startCreate() {
    createReplay.current = null;
    setSelected(null);
    setForm(blankForm(context, activePathId));
    setCreating(true);
    setPreviewing(false);
    setError("");
    setMessage("");
  }

  function repertoireFor(family = form.family): BoPracticeCatalogItem[] {
    return context?.paths.find(path => path.id === form.pathProgramId)?.repertoireItems.filter(item => item.repertoireClass === classForFamily(family)) ?? [];
  }

  function changeCreateFamily(family: BoPracticeFamily) {
    const item = context?.paths.find(path => path.id === form.pathProgramId)?.repertoireItems.find(candidate => candidate.repertoireClass === classForFamily(family));
    createReplay.current = null;
    setForm(current => ({ ...current, family, pianoRepertoireItemId: item?.id ?? "" }));
  }

  async function createResource() {
    if (!form.title.trim()) return setError("Tên Practice Resource là bắt buộc.");
    if (!form.pathProgramId || !form.pianoRepertoireItemId) return setError("Path và Piano repertoire item là bắt buộc.");
    const payload = { title: form.title.trim(), family: form.family, pathProgramId: form.pathProgramId, pianoRepertoireItemId: form.pianoRepertoireItemId };
    const signature = JSON.stringify(payload);
    if (createReplay.current?.signature !== signature) createReplay.current = { signature, key: crypto.randomUUID() };
    setBusy("create"); setError("");
    try {
      const detail = await boApi.createPracticeResource(payload, createReplay.current.key);
      createReplay.current = null;
      setSelected(detail); setForm(formFromDetail(detail)); setCreating(false);
      setMessage("Đã tạo canonical draft. Có thể attach Sheet / Worksheet.");
      await refreshLibrary(detail.pathProgramId);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  function patchPage(index: number, patch: Partial<PageForm>) {
    setForm(current => ({ ...current, pages: current.pages.map((page, pageIndex) => pageIndex === index ? { ...page, ...patch } : page) }));
  }
  function addPage() { setForm(current => ({ ...current, pages: [...current.pages, blankPage()] })); }
  function removePage(index: number) { setForm(current => ({ ...current, pages: current.pages.filter((_, pageIndex) => pageIndex !== index) })); }
  function movePage(index: number, direction: -1 | 1) {
    setForm(current => {
      const target = index + direction; if (target < 0 || target >= current.pages.length) return current;
      const pages = [...current.pages]; [pages[index], pages[target]] = [pages[target]!, pages[index]!]; return { ...current, pages };
    });
  }

  async function upload(index: number, kind: "sheet" | "worksheet", file: File) {
    if (!selected) return;
    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(file.type)) return setError("Practice media chỉ hỗ trợ PNG, JPEG hoặc WebP.");
    const slot = `${selected.id}:${index}:${kind}`, signature = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
    if (uploadReplay.current[slot]?.signature !== signature) uploadReplay.current[slot] = { signature, key: crypto.randomUUID() };
    setBusy(`upload-${index}-${kind}`); setError("");
    try {
      const media = await boApi.uploadPracticeMedia(file, selected.pathProgramId, uploadReplay.current[slot]!.key);
      delete uploadReplay.current[slot];
      const previewUrl = URL.createObjectURL(file);
      patchPage(index, kind === "sheet"
        ? { sheetMediaAssetId: media.mediaAssetId, sheetPreviewUrl: previewUrl, sheetName: file.name }
        : { worksheetMediaAssetId: media.mediaAssetId, worksheetPreviewUrl: previewUrl, worksheetName: file.name });
      setMessage(`${kind === "sheet" ? "Sheet" : "Worksheet"} đã ingest thành opaque media asset.`);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  function validateDraft(): string | null {
    if (!form.title.trim()) return "Tên Practice Resource là bắt buộc.";
    if (form.pages.length < 1) return "Practice Resource phải có ít nhất một page.";
    if (form.pages.some(page => !page.sheetMediaAssetId.trim())) return "Mỗi page phải có Sheet trước khi lưu/publish.";
    return null;
  }

  async function persistDisplayedDraft(): Promise<BoPracticeResourceVersion> {
    if (!selected) throw new Error("Practice Resource chưa được chọn.");
    let draft = selected.draft;
    if (!draft) draft = await boApi.ensurePracticeDraft(selected.id);
    const titled = await boApi.updatePracticeDraft(draft.id, form.title.trim(), draft.revision);
    const paged = await boApi.replacePracticePages(titled.id, titled.revision, form.pages.map(page => ({
      sheetMediaAssetId: page.sheetMediaAssetId,
      worksheetMediaAssetId: page.worksheetMediaAssetId || null,
    })));
    setSelected(current => current ? { ...current, draft: paged } : current);
    return paged;
  }

  async function saveDraft() {
    const validation = validateDraft(); if (validation) return setError(validation);
    setBusy("save"); setError("");
    try {
      await persistDisplayedDraft();
      const detail = await boApi.practiceResource(selected!.id);
      setSelected(detail); setForm(formFromDetail(detail));
      setMessage("Draft đã lưu theo revision mới nhất.");
      await refreshLibrary(detail.pathProgramId);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  async function publish() {
    const validation = validateDraft(); if (validation) return setError(validation);
    setBusy("publish"); setError("");
    try {
      const saved = await persistDisplayedDraft();
      const detail = await boApi.publishPracticeVersion(saved.id, saved.revision);
      setSelected(detail); setForm(formFromDetail(detail)); setPreviewing(false);
      setMessage(`Published v${detail.currentPublished?.versionNumber ?? "?"}. Displayed draft và published version là cùng canonical revision.`);
      await refreshLibrary(detail.pathProgramId);
    } catch (cause) { showError(cause); }
    finally { setBusy(""); }
  }

  function showError(cause: unknown) {
    if (cause instanceof BoApiError) { setError(`${cause.message}${cause.requestId ? ` · request ${cause.requestId}` : ""}`); return; }
    setError(cause instanceof Error ? cause.message : "Practice operation failed.");
  }

  if (loading) return <main className={`${bo.page} ${styles.practicePage}`}><div className={bo.state}><strong>Đang tải Piano Practice…</strong></div></main>;
  const currentPath = context?.paths.find(path => path.id === activePathId);
  const currentItem = context?.paths.find(path => path.id === form.pathProgramId)?.repertoireItems.find(item => item.id === form.pianoRepertoireItemId);

  return <main className={`${bo.page} ${styles.practicePage}`}>
    <header className={styles.header}>
      <div className={bo.heading}><span>Learning · PSP-PIANO / F0</span><h1>Piano Practice</h1><p>BO là thin authoring client; Core giữ identity, permission, media, revision và publication truth.</p></div>
      <button className={bo.primaryButton} disabled={!activePathId} onClick={startCreate}>+ New Practice</button>
    </header>
    {error ? <div className={`${bo.card} ${bo.denied}`}><strong>Không thể hoàn tất</strong><span>{error}</span></div> : null}
    {message ? <div className={bo.successCard}><span>Practice</span><strong>{message}</strong></div> : null}

    <div className={styles.workspace}>
      <aside className={styles.library}>
        <div className={styles.libraryHead}><strong>Practice library</strong><span>{resources.length}</span></div>
        <label className={bo.field}>Path
          <select value={activePathId} onChange={event => void changePath(event.target.value)}>
            {context?.paths.map(path => <option key={path.id} value={path.id}>{path.displayName}</option>)}
          </select>
        </label>
        {resources.length === 0 ? <small>{currentPath ? "Chưa có Practice Resource trong Path này." : "Không có Path được Practice permission cho phép."}</small> : resources.map(resource => (
          <button key={resource.id} className={`${styles.resourceButton} ${selected?.id === resource.id ? styles.resourceActive : ""}`} onClick={() => void selectResource(resource.id)}>
            <strong>{resource.draft?.title ?? resource.title}</strong>
            <span>{resource.family} · {resource.draft ? "DRAFT" : "PUBLISHED"}</span>
            <small>draft {resource.draft?.versionNumber ?? "—"} · published {resource.currentPublished?.versionNumber ?? "—"}</small>
          </button>
        ))}
      </aside>

      <section className={styles.editor}>
        {!creating && !selected ? <div className={bo.empty}>Chọn một Practice hoặc tạo mới.</div> : <>
          <div className={styles.editorHead}>
            <div><span className={bo.status}>{creating ? "NEW DRAFT" : selected?.draft ? "DRAFT" : "PUBLISHED"}</span><h2>{form.title || "Create Practice Resource"}</h2>{selected ? <small>resource {selected.id} · draft revision {selected.draft?.revision ?? "—"}</small> : null}</div>
            {selected ? <button className={bo.secondaryButton} onClick={() => setPreviewing(value => !value)}>{previewing ? "Edit draft" : "Preview draft"}</button> : null}
          </div>

          <div className={styles.metaGrid}>
            <label className={bo.field}>Tên Practice<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Always With Me" /></label>
            <label className={bo.field}>Family
              <select value={form.family} disabled={!creating} onChange={event => changeCreateFamily(event.target.value as BoPracticeFamily)}><option value="STARTER">Khởi Hành</option><option value="JOURNEY">Hành Trình</option><option value="SPECIALTY">Chuyên Đề</option></select>
            </label>
            <label className={bo.field}>Path<input value={currentPath?.displayName ?? form.pathProgramId} disabled /></label>
            <label className={bo.field}>Repertoire
              {creating ? <select value={form.pianoRepertoireItemId} onChange={event => { createReplay.current = null; setForm(current => ({ ...current, pianoRepertoireItemId: event.target.value })); }}><option value="">Chọn repertoire…</option>{repertoireFor().map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select> : <input value={currentItem?.title ?? form.pianoRepertoireItemId} disabled />}
            </label>
          </div>

          {creating ? <div className={styles.createGate}><div><strong>Tạo resource trước khi attach media</strong><span>Resource context được Core validate theo Path + canonical repertoire.</span></div><button className={bo.primaryButton} disabled={!!busy} onClick={() => void createResource()}>{busy === "create" ? "Đang tạo…" : "Create draft"}</button></div>
          : previewing ? <DraftPreview title={form.title} pages={form.pages} />
          : <div className={styles.pageStack}>
              <div className={styles.pageStackHead}><div><strong>Ordered pages</strong><span>Sheet bắt buộc · Worksheet tùy chọn</span></div><button className={bo.secondaryButton} onClick={addPage}>+ Add page</button></div>
              {form.pages.map((page, index) => <article className={styles.pageCard} key={page.id ?? `new-${index}`}>
                <div className={styles.pageTop}><div><span>Page {index + 1}</span><small>{page.id ?? "new page"}</small></div><div className={styles.pageActions}><button className={bo.secondaryButton} disabled={index === 0} onClick={() => movePage(index, -1)}>↑</button><button className={bo.secondaryButton} disabled={index === form.pages.length - 1} onClick={() => movePage(index, 1)}>↓</button><button className={styles.removeButton} disabled={form.pages.length === 1} onClick={() => removePage(index)}>Remove</button></div></div>
                <div className={styles.mediaGrid}>
                  <MediaSlot label="Sheet" required mediaAssetId={page.sheetMediaAssetId} fileName={page.sheetName} previewUrl={page.sheetPreviewUrl} busy={busy === `upload-${index}-sheet`} onFile={file => void upload(index, "sheet", file)} />
                  <MediaSlot label="Worksheet" mediaAssetId={page.worksheetMediaAssetId ?? ""} fileName={page.worksheetName} previewUrl={page.worksheetPreviewUrl} busy={busy === `upload-${index}-worksheet`} onFile={file => void upload(index, "worksheet", file)} onRemove={() => patchPage(index, { worksheetMediaAssetId: null, worksheetPreviewUrl: null, worksheetName: undefined })} />
                </div>
              </article>)}
            </div>}

          {!creating ? <div className={styles.publishBar}><div><strong>{selected?.draft?.formatDefinition ?? selected?.currentPublished?.formatDefinition ?? PIANO_PRACTICE_FORMAT_V1}</strong><span>Publish luôn save chính nội dung đang hiển thị, rồi dùng revision Core trả về.</span></div><div><button className={bo.secondaryButton} disabled={!!busy || previewing} onClick={() => void saveDraft()}>{busy === "save" ? "Saving…" : "Save draft"}</button><button className={bo.primaryButton} disabled={!!busy || previewing} onClick={() => void publish()}>{busy === "publish" ? "Publishing…" : "Publish version"}</button></div></div> : null}
        </>}
      </section>
    </div>
  </main>;
}

type MediaSlotProps = { label:string;required?:boolean;mediaAssetId:string;fileName?:string;previewUrl?:string|null;busy:boolean;onFile:(file:File)=>void;onRemove?:()=>void };
function MediaSlot({ label, required, mediaAssetId, fileName, previewUrl, busy, onFile, onRemove }: MediaSlotProps) {
  return <div className={styles.mediaSlot}><div className={styles.mediaHead}><strong>{label}{required ? " *" : ""}</strong><span>{mediaAssetId ? "READY" : required ? "REQUIRED" : "OPTIONAL"}</span></div>{previewUrl ? <img className={styles.assetPreview} src={previewUrl} alt={`${label} preview`} /> : <div className={styles.assetEmpty}>{mediaAssetId ? "Opaque media asset ready" : `No ${label}`}</div>}<small>{fileName ?? (mediaAssetId || (required ? "Upload required" : "Missing Worksheet is valid"))}</small><div className={styles.mediaActions}><label className={bo.secondaryButton}>{busy ? "Uploading…" : mediaAssetId ? "Replace" : "Upload"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /></label>{onRemove && mediaAssetId ? <button className={styles.removeButton} disabled={busy} onClick={onRemove}>Remove Worksheet</button> : null}</div></div>;
}
function DraftPreview({ title, pages }: { title:string;pages:PageForm[] }) {
  return <section className={styles.previewPanel}><div><span className={bo.status}>DRAFT PREVIEW</span><h3>{title || "Untitled Practice"}</h3></div><div className={styles.previewGrid}>{pages.map((page, index) => <article className={styles.previewPage} key={page.id ?? index}><strong>Page {index + 1}</strong><PreviewAsset label="Sheet" previewUrl={page.sheetPreviewUrl} mediaAssetId={page.sheetMediaAssetId} />{page.worksheetMediaAssetId ? <PreviewAsset label="Worksheet" previewUrl={page.worksheetPreviewUrl} mediaAssetId={page.worksheetMediaAssetId} /> : null}</article>)}</div></section>;
}
function PreviewAsset({ label, previewUrl, mediaAssetId }: { label:string;previewUrl?:string|null;mediaAssetId:string }) {
  return <div className={styles.previewAsset}><span>{label}</span>{previewUrl ? <img src={previewUrl} alt={`${label} draft preview`} /> : <small>{mediaAssetId || "Missing media"}</small>}</div>;
}
