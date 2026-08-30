"use client";

import { useEffect, useState } from "react";
import bo from "../bo.module.css";

type SpeciesStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type Species = {
  id: string;
  key: string;
  displayName: string;
  eggAssetKey: string;
  companionAssetKey: string;
  sigilAssetKey: string | null;
  presentationProfileKey: string;
  metadata: Record<string, unknown>;
  status: SpeciesStatus;
  version: number;
};
type Envelope<T> = { data?: T; error?: { message?: string } };
type SpeciesForm = {
  key: string;
  displayName: string;
  eggAssetKey: string;
  companionAssetKey: string;
  sigilAssetKey: string;
  presentationProfileKey: string;
};
const defaultSpecies = (): SpeciesForm => ({
  key: "mori-water",
  displayName: "Mori",
  eggAssetKey: "pinoria/Companion/Egg-water.png",
  companionAssetKey: "pinoria/Companion/mori-sleep.png",
  sigilAssetKey: "pinoria/Companion/Sigil-mori.png",
  presentationProfileKey: "egg-water-v1",
});

function localValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/founder/${path}`, { cache: "no-store", ...init });
  const json = await response.json() as Envelope<T>;
  if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Pinoria Companion operation failed");
  return json.data;
}
function speciesPayload(form: SpeciesForm) {
  return {
    ...form,
    sigilAssetKey: form.sigilAssetKey || null,
    metadata: { element: "water" },
  };
}
export function PinoriaCompanionsView() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [form, setForm] = useState<SpeciesForm>(defaultSpecies);
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null);
  const [studentProfileId, setStudentProfileId] = useState("");
  const [eggSpeciesId, setEggSpeciesId] = useState("");
  const [readyAt, setReadyAt] = useState(() => localValue(new Date()));
  const [sourceKey, setSourceKey] = useState("bo-manual");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const items = await request<Species[]>("pinoria/companions/species");
      setSpecies(items);
      const firstActive = items.find((item) => item.status === "ACTIVE");
      if (firstActive) setEggSpeciesId((current) => current || firstActive.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được Companion Species");
    }
  }
  useEffect(() => { void load(); }, []);
  function edit(item: Species) {
    setEditing({ id: item.id, version: item.version });
    setForm({
      key: item.key,
      displayName: item.displayName,
      eggAssetKey: item.eggAssetKey,
      companionAssetKey: item.companionAssetKey,
      sigilAssetKey: item.sigilAssetKey ?? "",
      presentationProfileKey: item.presentationProfileKey,
    });
  }
  function reset() {
    setEditing(null);
    setForm(defaultSpecies());
  }
  async function saveSpecies() {
    setBusy("species"); setError(""); setMessage("");
    try {
      const item = editing
        ? await request<Species>(`pinoria/companions/species/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...speciesPayload(form), expectedVersion: editing.version }) })
        : await request<Species>("pinoria/companions/species", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(speciesPayload(form)) });
      setMessage(`${item.displayName}: ${item.status}`); reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được Species"); }
    finally { setBusy(""); }
  }
  async function lifecycle(item: Species, action: "activate" | "archive") {
    setBusy(`${item.id}:${action}`); setError(""); setMessage("");
    try {
      const updated = await request<Species>(`pinoria/companions/species/${item.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: item.version }),
      });
      setMessage(`${updated.displayName}: ${updated.status}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lifecycle command failed");
    } finally { setBusy(""); }
  }
  async function createEgg() {
    setBusy("egg"); setError(""); setMessage("");
    try {
      const egg = await request<{ id: string; status: string }>("pinoria/companions/eggs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentProfileId: studentProfileId.trim(),
          speciesId: eggSpeciesId,
          readyAt: new Date(readyAt).toISOString(),
          sourceKey,
        }),
      });
      setMessage(`Đã cấp Egg ${egg.id.slice(0, 8)} · ${egg.status}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cấp được Egg");
    } finally { setBusy(""); }
  }
  const activeSpecies = species.filter((item) => item.status === "ACTIVE");
  function field<K extends keyof SpeciesForm>(key: K, value: SpeciesForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return <div className={bo.page}>
    <header className={bo.heading}>
      <span>PINORIA · STAGING CONFIG</span>
      <h1>Companion Species & Eggs</h1>
      <p>BO quản lý visual/content Species và cấp Egg; Hatch eligibility và ownership luôn do Core quyết định.</p>
    </header>
    <section className={bo.metrics}>
      <div className={bo.metric}><span>Species</span><strong>{species.length}</strong></div>
      <div className={bo.metric}><span>Active</span><strong>{activeSpecies.length}</strong></div>
      <div className={bo.metric}><span>TV profile</span><strong>Egg Hatch</strong></div>
    </section>
    {error ? <div className={`${bo.card} ${bo.denied}`}><strong>Lỗi</strong><span>{error}</span></div> : null}
    {message ? <div className={bo.successCard}><span>Pinoria Companion</span><strong>{message}</strong></div> : null}
    <section className={bo.panel}>
      <div className={bo.panelHeading}>
        <div><h2>{editing ? "Sửa Species draft" : "Tạo Companion Species"}</h2><p>ACTIVE Species immutable; archive bị chặn khi còn Egg mở hoặc Activity đang publish.</p></div>
        <span className={bo.writePill}>STAGING WRITE</span>
      </div>
      <div className={bo.formGrid}>
        <label className={bo.field}>Species key<input value={form.key} disabled={!!editing} onChange={(event) => field("key", event.target.value)} /></label>
        <label className={bo.field}>Tên hiển thị<input value={form.displayName} onChange={(event) => field("displayName", event.target.value)} /></label>
        <label className={bo.field}>Egg asset<input value={form.eggAssetKey} onChange={(event) => field("eggAssetKey", event.target.value)} /></label>
        <label className={bo.field}>Companion asset<input value={form.companionAssetKey} onChange={(event) => field("companionAssetKey", event.target.value)} /></label>
        <label className={bo.field}>Sigil asset<input value={form.sigilAssetKey} onChange={(event) => field("sigilAssetKey", event.target.value)} /></label>
        <label className={bo.field}>TV presentation profile<input value={form.presentationProfileKey} onChange={(event) => field("presentationProfileKey", event.target.value)} /></label>
      </div>
      <div className={bo.commandBar}>
        <div><strong>Visual recipe: Mori · Water Egg</strong><span>Asset keys resolve qua assets.pinohouse.art; business state không nằm trong TV.</span></div>
        <div className={bo.headingActions}>
          {editing ? <button className={bo.secondaryButton} onClick={reset}>Hủy sửa</button> : null}
          <button className={bo.primaryButton} disabled={!!busy} onClick={() => void saveSpecies()}>{busy === "species" ? "Đang lưu…" : editing ? "Lưu Draft" : "Tạo Draft"}</button>
        </div>
      </div>
    </section>
    <section className={bo.panel}>
      <div className={bo.panelHeading}>
        <div><h2>Species lifecycle</h2><p>DRAFT → ACTIVE → ARCHIVED.</p></div>
        <button className={bo.secondaryButton} onClick={() => void load()}>Refresh</button>
      </div>
      <div className={bo.ownerQueue}>
        {species.length === 0 ? <div className={bo.empty}>Chưa có Companion Species.</div> : species.map((item) => <article className={bo.ownerRow} key={item.id}>
          <div className={bo.ownerMeta}>
            <span className={bo.statusPill}>{item.status}</span>
            <strong>{item.displayName}</strong>
            <span>{item.key} · {item.presentationProfileKey}</span>
            <small>{item.eggAssetKey}</small>
            <small>{item.companionAssetKey} · v{item.version}</small>
          </div>
          <div className={bo.staffActions}>
            {item.status === "DRAFT" ? <button className={bo.secondaryButton} disabled={!!busy} onClick={() => edit(item)}>Edit</button> : null}
            {item.status === "DRAFT" ? <button className={bo.primaryButton} disabled={!!busy} onClick={() => void lifecycle(item, "activate")}>Activate</button> : null}
            {item.status === "ACTIVE" ? <button className={bo.secondaryButton} disabled={!!busy} onClick={() => void lifecycle(item, "archive")}>Archive</button> : null}
          </div>
          <code className={bo.id}>{item.id}</code>
        </article>)}
      </div>
    </section>
    <section className={bo.panel}>
      <div className={bo.panelHeading}>
        <div><h2>Cấp Egg cho learner</h2><p>Dùng canonical Student Profile ID. READY time có thể là ngay bây giờ cho staging E2E.</p></div>
        <span className={bo.writePill}>CORE WRITE</span>
      </div>
      <div className={bo.formGrid}>
        <label className={bo.field}>Student Profile ID<input value={studentProfileId} onChange={(event) => setStudentProfileId(event.target.value)} placeholder="Canonical UUID" /></label>
        <label className={bo.field}>Species<select value={eggSpeciesId} onChange={(event) => setEggSpeciesId(event.target.value)}><option value="">Chọn ACTIVE Species</option>{activeSpecies.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label className={bo.field}>Ready at<input type="datetime-local" value={readyAt} onChange={(event) => setReadyAt(event.target.value)} /></label>
        <label className={bo.field}>Source key<input value={sourceKey} onChange={(event) => setSourceKey(event.target.value)} /></label>
      </div>
      <div className={bo.commandBar}>
        <div><strong>Egg grant ≠ Hatch</strong><span>BO chỉ cấp state; TOS mới thực hiện Hatch khi Core trả eligible.</span></div>
        <button className={bo.primaryButton} disabled={!!busy || !studentProfileId.trim() || !eggSpeciesId} onClick={() => void createEgg()}>{busy === "egg" ? "Đang cấp…" : "Cấp Egg"}</button>
      </div>
    </section>
  </div>;
}
