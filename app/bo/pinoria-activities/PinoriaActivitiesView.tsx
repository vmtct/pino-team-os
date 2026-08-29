"use client";

import { useEffect, useState } from "react";
import bo from "../bo.module.css";

type ActivityStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "RETIRED";
type Center = { id: string; key: string; displayName: string; timeZone: string; status: string };
type Activity = {
  id: string;
  key: string;
  handlerKey: "WISH_DRAW";
  staffName: string;
  learnerName: string;
  iconAssetKey: string | null;
  centerId: string | null;
  presentationProfileKey: string;
  config: { familyKey: string };
  status: ActivityStatus;
  startsAt: string;
  endsAt: string;
  definitionHash: string | null;
  version: number;
};
type Envelope<T> = { data?: T; error?: { message?: string } };
type FormState = {
  key: string;
  staffName: string;
  learnerName: string;
  iconAssetKey: string;
  centerId: string;
  presentationProfileKey: string;
  familyKey: string;
  startsAt: string;
  endsAt: string;
};

function localValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function initialForm(): FormState {
  return {
    key: `wish-draw-${Date.now()}`,
    staffName: "Gieo Hạt Năng Lượng",
    learnerName: "Ước nguyện Hạt Năng Lượng",
    iconAssetKey: "",
    centerId: "",
    presentationProfileKey: "wish-reveal-v1",
    familyKey: "LIMITED_WARDROBE",
    startsAt: localValue(new Date(Date.now() - 5 * 60_000)),
    endsAt: localValue(new Date(Date.now() + 30 * 86_400_000)),
  };
}
async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/founder/${path}`, { cache: "no-store", ...init });
  const json = await response.json() as Envelope<T>;
  if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Pinoria Activity operation failed");
  return json.data;
}
function payload(form: FormState) {
  return {
    key: form.key,
    handlerKey: "WISH_DRAW",
    staffName: form.staffName,
    learnerName: form.learnerName,
    iconAssetKey: form.iconAssetKey || null,
    centerId: form.centerId || null,
    presentationProfileKey: form.presentationProfileKey,
    config: { familyKey: form.familyKey },
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: new Date(form.endsAt).toISOString(),
  };
}

export function PinoriaActivitiesView() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    try {
      const [items, scopeCenters] = await Promise.all([
        request<Activity[]>("pinoria/activities"),
        request<Center[]>("pinoria/activities/centers"),
      ]);
      setActivities(items);
      setCenters(scopeCenters);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được Pinoria Activities");
    }
  }
  useEffect(() => { void load(); }, []);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function reset() {
    setEditing(null);
    setForm(initialForm());
  }
  function edit(activity: Activity) {
    setEditing({ id: activity.id, version: activity.version });
    setForm({
      key: activity.key,
      staffName: activity.staffName,
      learnerName: activity.learnerName,
      iconAssetKey: activity.iconAssetKey ?? "",
      centerId: activity.centerId ?? "",
      presentationProfileKey: activity.presentationProfileKey,
      familyKey: activity.config.familyKey,
      startsAt: localValue(new Date(activity.startsAt)),
      endsAt: localValue(new Date(activity.endsAt)),
    });
  }
  async function save() {
    setBusy("save"); setError(""); setMessage("");
    try {
      const body = payload(form);
      const item = editing
        ? await request<Activity>(`pinoria/activities/${editing.id}`, {
            method: "PATCH", headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, expectedVersion: editing.version }),
          })
        : await request<Activity>("pinoria/activities", {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
          });
      setMessage(`${editing ? "Đã lưu" : "Đã tạo"} ${item.staffName}`);
      reset(); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được Activity");
    } finally { setBusy(""); }
  }
  async function validate(activity: Activity) {
    setBusy(`${activity.id}:validate`); setError(""); setMessage("");
    try {
      const result = await request<{ valid: boolean; issues: string[]; definitionHash: string | null }>(`pinoria/activities/${activity.id}/validation`);
      setMessage(result.valid ? `Validation PASS · ${result.definitionHash?.slice(0, 12)}` : `Validation FAIL · ${result.issues.join(" · ")}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Validation failed"); }
    finally { setBusy(""); }
  }
  async function lifecycle(activity: Activity, action: "schedule" | "activate" | "retire") {
    setBusy(`${activity.id}:${action}`); setError(""); setMessage("");
    try {
      const updated = await request<Activity>(`pinoria/activities/${activity.id}/${action}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: activity.version }),
      });
      setMessage(`${updated.staffName}: ${updated.status}`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Lifecycle command failed"); }
    finally { setBusy(""); }
  }
  return <div className={bo.page}>
    <header className={bo.heading}>
      <span>PINORIA · STAGING CONFIG</span>
      <h1>Pinoria Activities</h1>
      <p>Định nghĩa hoạt động một lần trong BO. TOS đọc eligibility/action từ Core; handler v1 là Wish Draw.</p>
    </header>
    <section className={bo.metrics}>
      <div className={bo.metric}><span>Definitions</span><strong>{activities.length}</strong></div>
      <div className={bo.metric}><span>Active</span><strong>{activities.filter((item) => item.status === "ACTIVE").length}</strong></div>
      <div className={bo.metric}><span>Centers</span><strong>{centers.length}</strong></div>
      <div className={bo.metric}><span>Handlers</span><strong>1</strong></div>
    </section>
    {error ? <div className={`${bo.card} ${bo.denied}`}><strong>Lỗi</strong><span>{error}</span></div> : null}
    {message ? <div className={bo.successCard}><span>Pinoria Activities</span><strong>{message}</strong></div> : null}

    <section className={bo.panel}>
      <div className={bo.panelHeading}>
        <div><h2>{editing ? "Sửa Activity draft" : "Tạo Activity"}</h2><p>Published snapshot immutable; chỉ DRAFT mới được sửa.</p></div>
        <span className={bo.writePill}>STAGING WRITE</span>
      </div>
      <div className={bo.formGrid}>
        <label className={bo.field}>Activity key<input value={form.key} disabled={!!editing} onChange={(event) => field("key", event.target.value)} /></label>
        <label className={bo.field}>Handler<select value="WISH_DRAW" disabled><option>WISH_DRAW</option></select></label>
        <label className={bo.field}>Tên staff<input value={form.staffName} onChange={(event) => field("staffName", event.target.value)} /></label>
        <label className={bo.field}>Tên học viên thấy<input value={form.learnerName} onChange={(event) => field("learnerName", event.target.value)} /></label>
        <label className={bo.field}>Center scope<select value={form.centerId} onChange={(event) => field("centerId", event.target.value)}>
          <option value="">Tất cả Center</option>
          {centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}
        </select></label>
        <label className={bo.field}>Icon asset key<input value={form.iconAssetKey} onChange={(event) => field("iconAssetKey", event.target.value)} placeholder="optional" /></label>
        <label className={bo.field}>TV presentation profile<input value={form.presentationProfileKey} onChange={(event) => field("presentationProfileKey", event.target.value)} /></label>
        <label className={bo.field}>Wish family<input value={form.familyKey} onChange={(event) => field("familyKey", event.target.value)} /></label>
        <label className={bo.field}>Bắt đầu<input type="datetime-local" value={form.startsAt} onChange={(event) => field("startsAt", event.target.value)} /></label>
        <label className={bo.field}>Kết thúc<input type="datetime-local" value={form.endsAt} onChange={(event) => field("endsAt", event.target.value)} /></label>
      </div>
      <div className={bo.commandBar}>
        <div><strong>Handler registry v1: WISH_DRAW</strong><span>Egg / Evolution / Ritual chỉ được thêm khi Core có authoritative domain state.</span></div>
        <div className={bo.headingActions}>
          {editing ? <button className={bo.secondaryButton} onClick={reset}>Hủy sửa</button> : null}
          <button className={bo.primaryButton} disabled={!!busy} onClick={() => void save()}>{busy === "save" ? "Đang lưu…" : editing ? "Lưu Draft" : "Tạo Draft"}</button>
        </div>
      </div>
    </section>
    <section className={bo.panel}>
      <div className={bo.panelHeading}>
        <div><h2>Activity lifecycle</h2><p>DRAFT → validate → SCHEDULED → ACTIVE → RETIRED.</p></div>
        <button className={bo.secondaryButton} onClick={() => void load()}>Refresh</button>
      </div>
      <div className={bo.ownerQueue}>
        {activities.length === 0 ? <div className={bo.empty}>Chưa có Activity Definition.</div> : activities.map((activity) => <article className={bo.ownerRow} key={activity.id}>
          <div className={bo.ownerMeta}>
            <span className={bo.statusPill}>{activity.status}</span>
            <strong>{activity.staffName}</strong>
            <span>{activity.learnerName} · {activity.handlerKey}</span>
            <small>{centers.find((center) => center.id === activity.centerId)?.displayName ?? "Tất cả Center"} · {activity.presentationProfileKey} · {activity.config.familyKey}</small>
            <small>{new Date(activity.startsAt).toLocaleString("vi-VN")} → {new Date(activity.endsAt).toLocaleString("vi-VN")} · v{activity.version}</small>
          </div>
          <div className={bo.staffActions}>
            {activity.status === "DRAFT" ? <button className={bo.secondaryButton} disabled={!!busy} onClick={() => edit(activity)}>Edit</button> : null}
            {activity.status === "DRAFT" ? <button className={bo.secondaryButton} disabled={!!busy} onClick={() => void validate(activity)}>Validate</button> : null}
            {activity.status === "DRAFT" ? <button className={bo.primaryButton} disabled={!!busy} onClick={() => void lifecycle(activity, "schedule")}>Schedule</button> : null}
            {activity.status === "SCHEDULED" ? <button className={bo.primaryButton} disabled={!!busy} onClick={() => void lifecycle(activity, "activate")}>Activate</button> : null}
            {activity.status === "SCHEDULED" || activity.status === "ACTIVE" ? <button className={bo.secondaryButton} disabled={!!busy} onClick={() => void lifecycle(activity, "retire")}>Retire</button> : null}
          </div>
          {activity.definitionHash ? <code className={bo.id}>snapshot {activity.definitionHash}</code> : null}
        </article>)}
      </div>
    </section>
  </div>;
}
