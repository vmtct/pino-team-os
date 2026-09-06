"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell";
import { TOS_SHIFT_FOOTER } from "@/app/components/tos-shell/navigation";
import availabilityStyles from "./workforce-availability.module.css";
import {
  workforceApi,
  WorkforceApiError,
  type Assignment,
  type Availability,
  type ShiftTemplate,
  type StaffProfile,
  type TimekeepingSession,
  type UnscheduledCheckInSelfState,
  type WorkforceContext,
} from "@/lib/workforce-api";

type View = "dashboard" | "schedule" | "availability" | "profile" | "check-in" | "history";

function today() { return new Date().toISOString().slice(0, 10); }
function offset(days: number) { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function weekDates(week: WorkforceContext["termWeeks"][number]) {
  const dates: string[] = [];
  const cursor = new Date(`${week.startDate}T00:00:00Z`);
  const end = new Date(`${week.endDate}T00:00:00Z`);
  while (cursor <= end) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return dates;
}
function message(error: unknown) {
  if (error instanceof WorkforceApiError) {
    if (error.code.includes("POLICY") || error.status === 503) return "Chính sách vận hành hiện chưa sẵn sàng. Không có thao tác nào được cho phép mặc định.";
    if (error.status === 401) return "Phiên đăng nhập local không hợp lệ. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Tài khoản chưa có quyền hoặc chưa liên kết với nhân sự đang hoạt động.";
    if (error.status === 409) return "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.";
  }
  return error instanceof Error ? error.message : "Không thể tải dữ liệu từ Core.";
}

export default function WorkforceWorkspace({ view }: { view: View }) {
  const [context, setContext] = useState<WorkforceContext | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [current, setCurrent] = useState<TimekeepingSession | null>(null);
  const [history, setHistory] = useState<TimekeepingSession[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [checkInState, setCheckInState] = useState<UnscheduledCheckInSelfState | null>(null);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const center = context?.centers[0] ?? null;
  const week = useMemo(() => context?.termWeeks.find((w) => w.centerId === center?.id && today() >= w.startDate && today() <= w.endDate) ?? context?.termWeeks.find((w) => w.centerId === center?.id) ?? null, [context, center]);

  async function load() {
    setLoading(true); setError("");
    try {
      const [c, p, t] = await Promise.all([workforceApi.context(), workforceApi.profile(), workforceApi.currentTimekeeping()]);
      setContext(c.data); setProfile(p.data); setCurrent(t.data);
      const selected = c.data.centers[0];
      if (selected) {
        const [s, h, exceptionState] = await Promise.all([
          workforceApi.schedule({ centerId: selected.id, startDate: offset(-30), endDate: offset(60) }),
          workforceApi.history({ centerId: selected.id, startDate: offset(-90), endDate: today() }),
          workforceApi.checkInExceptionStatus(selected.id),
        ]);
        setAssignments(s.data); setHistory(h.data); setCheckInState(exceptionState.data);
      }
    } catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function clock(action: "in" | "out") {
    if (!center) return;
    setSaving(true); setError("");
    try {
      if (action === "in") {
        const state = await workforceApi.checkInExceptionStatus(center.id);
        setCheckInState(state.data);
        if (state.data.kind !== "ELIGIBLE_ASSIGNMENT") return;
        await workforceApi.checkIn(center.id, state.data.assignment.id);
      } else await workforceApi.checkOut();
      await load();
    } catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  }
  async function requestUnscheduledCheckIn() {
    if (!center || !requestReason.trim()) return;
    setSaving(true); setError("");
    try {
      await workforceApi.requestUnscheduledCheckIn(center.id, requestReason.trim(), crypto.randomUUID());
      const state = await workforceApi.checkInExceptionStatus(center.id);
      setCheckInState(state.data);
      setRequestFormOpen(false); setRequestReason("");
    } catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  }
  async function openAvailability() {
    if (!week) return;
    setSaving(true); setError("");
    try {
      const result = await workforceApi.availabilityDraft(week.id);
      setAvailability(result.data.submission); setTemplates(result.data.templates);
    } catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  }
  async function toggle(date: string, templateId: string) {
    if (!availability || availability.status !== "DRAFT") return;
    const exists = availability.items.some((i) => i.workDate === date && i.shiftTemplateId === templateId);
    const items = exists
      ? availability.items.filter((i) => !(i.workDate === date && i.shiftTemplateId === templateId))
      : [...availability.items, { workDate: date, shiftTemplateId: templateId }];
    setSaving(true);
    try { const result = await workforceApi.replaceAvailability({ submissionId: availability.id, expectedVersion: availability.version, items }); setAvailability(result.data); }
    catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  }
  async function submitAvailability() {
    if (!availability) return;
    setSaving(true);
    try { const result = await workforceApi.submitAvailability({ submissionId: availability.id, expectedVersion: availability.version }); setAvailability(result.data); }
    catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  }

  const title = view === "profile" ? "Hồ sơ của tôi" : view === "history" ? "Chấm công" : view === "check-in" ? "Check-in/out" : view === "schedule" ? "Lịch của tôi" : view === "availability" ? "Đăng ký ca" : "Hôm nay";
  const active = view === "history" ? "history" : view === "check-in" ? "check" : view === "schedule" ? "schedule" : view === "availability" ? "register" : view === "dashboard" ? "today" : undefined;
  const todayAssignments = assignments.filter((row) => row.workDate === today());

  return <TosShell title={title} subtitle={profile?.displayLabel ?? "PINO Team"} theme="shift" footerItems={TOS_SHIFT_FOOTER} activeFooterId={active}>
    {loading ? <p>Đang tải dữ liệu an toàn từ Core…</p> : <>
      {error ? <div className="alert">{error}</div> : null}
      {profile && view === "profile" ? <Profile profile={profile} onSaved={setProfile} /> : null}
      {view === "dashboard" ? <>
        <section className="card section">
          <h2>{current ? "Đang làm việc" : "Chưa check-in"}</h2>
          <p className="muted">{current ? `Bắt đầu ${new Date(current.checkInAt).toLocaleString("vi-VN")}` : "Mở Check-in/out khi bắt đầu ca."}</p>
          <Link className="button" href="/check-in">Mở Check-in/out</Link>
        </section>
        <Schedule rows={todayAssignments} title="Ca hôm nay" />
      </> : null}
      {view === "schedule" ? <Schedule rows={assignments} title="Ca được phân công" /> : null}
      {view === "availability" ? <AvailabilityPanel week={week} availability={availability} templates={templates} saving={saving} onOpen={openAvailability} onToggle={toggle} onSubmit={submitAvailability} /> : null}
      {view === "check-in" ? <CheckInPanel current={current} state={checkInState} saving={saving} centerReady={Boolean(center)} formOpen={requestFormOpen} reason={requestReason} onReason={setRequestReason} onOpenForm={() => setRequestFormOpen(true)} onCancelForm={() => { setRequestFormOpen(false); setRequestReason(""); }} onClock={() => void clock(current ? "out" : "in")} onRequest={() => void requestUnscheduledCheckIn()} /> : null}
      {view === "history" ? <History rows={history} /> : null}
    </>}
  </TosShell>;
}

function CheckInPanel({ current, state, saving, centerReady, formOpen, reason, onReason, onOpenForm, onCancelForm, onClock, onRequest }: { current: TimekeepingSession | null; state: UnscheduledCheckInSelfState | null; saving: boolean; centerReady: boolean; formOpen: boolean; reason: string; onReason: (value: string) => void; onOpenForm: () => void; onCancelForm: () => void; onClock: () => void; onRequest: () => void }) {
  if (current) return <section className="card section"><h2>Đang làm việc</h2><p className="muted">Bắt đầu {new Date(current.checkInAt).toLocaleString("vi-VN")}</p><button className="button" disabled={saving || !centerReady} onClick={onClock}>CHECK OUT</button></section>;
  if (!state) return <section className="card section"><h2>Đang kiểm tra ca hôm nay…</h2><p className="muted">Core đang xác định trạng thái theo Center và múi giờ canonical.</p></section>;
  if (state.kind === "ELIGIBLE_ASSIGNMENT") return <section className="card section"><h2>Sẵn sàng check-in</h2><p className="muted">{state.assignment.shift?.displayLabel ?? "Ca làm đã được phân công"} · {state.assignment.workDate}</p><button className="button" disabled={saving || !centerReady} onClick={onClock}>CHECK IN</button></section>;
  if (state.kind === "REQUESTED") return <section className="card section"><h2>Đang chờ Manager duyệt</h2><p className="muted">Yêu cầu check-in ngoài lịch đã được Core ghi nhận. Bạn chưa thể check-in cho tới khi có assignment canonical.</p><button className="button" disabled={saving || !centerReady} onClick={onClock}>Kiểm tra lại</button></section>;
  if (state.kind === "DECLINED") return <section className="card section"><h2>Yêu cầu đã bị từ chối</h2><p className="muted">{state.request.declineReason ?? "Manager chưa chấp thuận check-in ngoài lịch."}</p></section>;
  if (state.kind === "APPROVED") return <section className="card section"><h2>Đã được duyệt</h2><p className="muted">Core đã duyệt yêu cầu. Kiểm tra lại assignment trước khi check-in.</p><button className="button" disabled={saving || !centerReady} onClick={onClock}>Kiểm tra & check-in</button></section>;
  if (state.kind === "CANCELLED") return <section className="card section"><h2>Yêu cầu đã huỷ</h2><p className="muted">Không có quyền check-in ngoài lịch từ yêu cầu này.</p></section>;
  return <section className="card section"><h2>Bạn chưa có ca làm được phân công cho hôm nay</h2><p className="muted">Check-in vẫn yêu cầu assignment canonical. Nếu bạn đang có mặt tại Center để làm việc, hãy gửi lý do để Manager duyệt.</p>{formOpen ? <div className="grid"><label>Lý do<textarea value={reason} maxLength={500} onChange={(event) => onReason(event.target.value)} rows={4} /></label><div style={{display:"flex",gap:8}}><button className="button" disabled={saving || !reason.trim()} onClick={onRequest}>Gửi yêu cầu</button><button className="button" disabled={saving} onClick={onCancelForm}>Huỷ</button></div></div> : <button className="button" disabled={saving || !centerReady} onClick={onOpenForm}>Yêu cầu check-in ngoài lịch</button>}</section>;
}

function Schedule({ rows, title }: { rows: Assignment[]; title: string }) {
  return <section className="card section" style={{ marginTop: 16 }}><h2>{title}</h2>{rows.length ? <div className="list">{rows.map((row) => <div className="list-item" key={row.id}><strong>{row.workDate} · {row.shift?.displayLabel ?? "Ca làm"}</strong><div className="muted">{row.shift ? `${row.shift.startLocalTime}–${row.shift.endLocalTime} · ${row.shift.code}` : row.status}</div></div>)}</div> : <p className="muted">Chưa có ca được phân công.</p>}</section>;
}
function AvailabilityPanel({ week, availability, templates, saving, onOpen, onToggle, onSubmit }: { week: WorkforceContext["termWeeks"][number] | null; availability: Availability | null; templates: ShiftTemplate[]; saving: boolean; onOpen: () => Promise<void>; onToggle: (date: string, templateId: string) => Promise<void>; onSubmit: () => Promise<void> }) {
  const submitted = availability?.status === "SUBMITTED";
  const selectedCount = availability?.items.length ?? 0;
  return <section className={`card section ${availabilityStyles.wrap}`}>
    <div className={availabilityStyles.summary}><div><h2>Đăng ký ca tuần</h2><p>{week ? `${week.code} · ${shortDate(week.startDate)} — ${shortDate(week.endDate)}` : "Chưa có tuần vận hành khả dụng."}</p></div>{availability ? <span className={`${availabilityStyles.status} ${submitted ? availabilityStyles.submitted : availabilityStyles.draft}`}>{submitted ? "Đã gửi" : "Bản nháp"}</span> : null}</div>
    {!week ? <div className={availabilityStyles.empty}>Chưa có TermWeek để đăng ký ca.</div> : !availability ? <><div className={availabilityStyles.empty}>Chọn các ca bạn có thể làm trong tuần. Manager sẽ dùng đăng ký này để xếp lịch chính thức.</div><button className="button" disabled={saving} onClick={() => void onOpen()}>Bắt đầu đăng ký</button></> : <>
      <div className={availabilityStyles.days}>{weekDates(week).map((date) => <div className={availabilityStyles.day} key={date}><div className={availabilityStyles.date}><span>{weekday(date)}</span><strong>{dayNumber(date)}</strong><span>{monthLabel(date)}</span></div><div className={availabilityStyles.shifts}>{templates.map((template) => { const selected = availability.items.some((item) => item.workDate === date && item.shiftTemplateId === template.id); return <button key={`${date}:${template.id}`} className={`${availabilityStyles.shift} ${selected ? availabilityStyles.selected : ""}`} disabled={saving || submitted} onClick={() => void onToggle(date, template.id)} aria-pressed={selected}><strong>{selected ? "✓ " : ""}{template.displayLabel}</strong><span>{template.startLocalTime}–{template.endLocalTime}</span></button>; })}</div></div>)}</div>
      <div className={availabilityStyles.actions}><p>{submitted ? "Đăng ký đã gửi. V1 không cho sửa sau submit." : `Đã chọn ${selectedCount} ca khả dụng. Đây chưa phải lịch làm việc chính thức.`}</p>{!submitted ? <button className={`button ${availabilityStyles.submit}`} disabled={saving} onClick={() => void onSubmit()}>{saving ? "Đang lưu…" : "Gửi cho Manager"}</button> : null}</div>
    </>}
  </section>;
}
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function weekday(value: string) { return new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function dayNumber(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function monthLabel(value: string) { return new Intl.DateTimeFormat("vi-VN", { month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function History({ rows }: { rows: TimekeepingSession[] }) { return <section className="card section">{rows.length ? <div className="list">{rows.map((row) => <div className="list-item" key={row.id}><strong>{row.workDate}</strong><div>{new Date(row.checkInAt).toLocaleString("vi-VN")} — {row.checkOutAt ? new Date(row.checkOutAt).toLocaleString("vi-VN") : "Đang mở"}</div></div>)}</div> : <p className="muted">Chưa có phiên chấm công.</p>}</section>; }
function Profile({ profile, onSaved }: { profile: StaffProfile; onSaved: (value: StaffProfile) => void }) { const [email, setEmail] = useState(profile.email ?? ""), [mobile, setMobile] = useState(profile.mobile ?? ""), [legalAddress, setAddress] = useState(profile.legalAddress ?? ""), [error, setError] = useState(""); async function save() { try { const result = await workforceApi.updateProfile({ email, mobile, legalAddress }); onSaved(result.data); } catch (e) { setError(message(e)); } } return <section className="card section"><h2>{profile.displayLabel}</h2><p className="muted">Chỉ hiển thị các thông tin bạn được phép tự cập nhật.</p>{error ? <div className="alert">{error}</div> : null}<div className="grid"><label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Điện thoại<input value={mobile} onChange={(e) => setMobile(e.target.value)} /></label><label>Địa chỉ<input value={legalAddress} onChange={(e) => setAddress(e.target.value)} /></label></div><button className="button" onClick={save}>Lưu hồ sơ</button></section>; }