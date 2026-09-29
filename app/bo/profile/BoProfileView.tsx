"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoContext, BoStaffProfile } from "@/lib/bo-model";
import { shortDisplayName } from "@/lib/display-name";
import styles from "../bo.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "account"; context: BoContext; profile: null; profileError?: string }
  | { kind: "ready"; context: BoContext; profile: BoStaffProfile };

export function BoProfileView() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void (async () => {
      const response = await fetch("/api/bo/context", { cache: "no-store" });
      const body = await response.json() as { data?: BoContext; error?: { message?: string } };
      if (!current) return;
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "Không thể tải tài khoản hiện tại.");
        return;
      }
      const context = body.data;
      if (!context.staffMemberId) {
        setState({ kind: "account", context, profile: null });
        return;
      }
      try {
        const profile = await boApi.staffRecord(context.staffMemberId);
        if (!current) return;
        setEmail(profile.email ?? "");
        setMobile(profile.mobile ?? "");
        setLegalAddress(profile.legalAddress ?? "");
        setState({ kind: "ready", context, profile });
      } catch (cause) {
        if (current) setState({ kind: "account", context, profile: null, profileError: cause instanceof Error ? cause.message : "Không thể tải hồ sơ nhân sự." });
      }
    })();
    return () => { current = false; };
  }, []);

  function apply(profile: BoStaffProfile) {
    setEmail(profile.email ?? "");
    setMobile(profile.mobile ?? "");
    setLegalAddress(profile.legalAddress ?? "");
  }

  async function save() {
    if (state.kind !== "ready") return;
    setSaving(true); setError(""); setMessage("");
    try {
      const profile = await boApi.updateStaff(state.profile.id, {
        email: email.trim() || null,
        mobile: mobile.trim() || null,
        legalAddress: legalAddress.trim() || null,
      });
      apply(profile);
      setState({ ...state, profile });
      setEditing(false);
      setMessage("Đã cập nhật thông tin liên hệ.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật hồ sơ.");
    } finally { setSaving(false); }
  }

  function cancel() {
    if (state.kind === "ready") apply(state.profile);
    setEditing(false); setError(""); setMessage("");
  }

  if (state.kind === "loading") return <section className={styles.page}><p>Đang tải hồ sơ…</p>{error ? <p className={styles.ownerError}>{error}</p> : null}</section>;

  const context = state.context;
  const profile = state.kind === "ready" ? state.profile : null;
  const shortName = shortDisplayName(profile?.displayLabel ?? context.displayName);

  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · MY PROFILE</span>
      <h1>{shortName ? `Chào ${shortName}` : "Hồ sơ của tôi"}</h1>
      <p>Thông tin của chính tài khoản đang đăng nhập. Role, phân quyền và trạng thái nhân sự chỉ đọc tại đây.</p>
    </header>

    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><h2>{profile?.displayLabel ?? context.displayName ?? "Tài khoản Back Office"}</h2><p>{context.email}</p></div>
        <span className={styles.readOnly}>{profile?.status ?? "account"}</span>
      </div>
      <div className={styles.formGrid}>
        <ReadFact label="Họ tên" value={profile?.displayLabel ?? context.displayName ?? "Chưa liên kết"} />
        <ReadFact label="Vai trò" value={profile?.roleLabel ?? "Chưa cập nhật"} />
        <ReadFact label="Bộ phận" value={profile?.department ?? "Chưa cập nhật"} />
        <ReadFact label="Loại nhân sự" value={profile?.employmentType ?? "Chưa cập nhật"} />
        <ReadFact label="Trạng thái Staff" value={profile?.status ?? "Chưa liên kết StaffMember"} />
        <ReadFact label="Email đăng nhập" value={context.email} />
      </div>
      {state.kind === "account" ? <p className={styles.staffWarning}>{context.staffMemberId ? state.profileError ?? "Không thể đọc hồ sơ nhân sự với quyền hiện tại." : "Tài khoản này chưa liên kết StaffMember. BO vẫn hoạt động theo quyền Access hiện hữu; tên không được suy đoán từ email."}</p> : null}
    </section>

    {profile ? <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><h2>Thông tin cá nhân</h2><p>Chỉ email hồ sơ, điện thoại và địa chỉ được chỉnh tại My Profile.</p></div>
        {!editing ? <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>Chỉnh sửa</button> : null}
      </div>
      {error ? <p className={styles.ownerError}>{error}</p> : null}
      {message ? <p className={styles.ownerBulkStatus}>{message}</p> : null}
      {editing ? <div className={styles.formGrid}>
        <Field label="Email hồ sơ" type="email" value={email} onChange={setEmail} />
        <Field label="Điện thoại" value={mobile} onChange={setMobile} />
        <Field label="Địa chỉ" value={legalAddress} onChange={setLegalAddress} />
        <div className={styles.staffActions}>
          <button type="button" className={styles.primaryButton} disabled={saving} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu"}</button>
          <button type="button" className={styles.secondaryButton} disabled={saving} onClick={cancel}>Huỷ</button>
        </div>
      </div> : <div className={styles.formGrid}>
        <ReadFact label="Email hồ sơ" value={profile.email ?? "Chưa cập nhật"} />
        <ReadFact label="Điện thoại" value={profile.mobile ?? "Chưa cập nhật"} />
        <ReadFact label="Địa chỉ" value={profile.legalAddress ?? "Chưa cập nhật"} />
      </div>}
    </section> : null}
  </section>;
}

function ReadFact({ label, value }: { label: string; value: string }) {
  return <div className={styles.field}><span>{label}</span><strong>{value}</strong></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className={styles.field}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
