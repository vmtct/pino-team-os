"use client";

import { useEffect, useState } from "react";
import type { BoContext } from "@/lib/bo-model";
import { shortDisplayName } from "@/lib/display-name";
import styles from "../bo.module.css";

export function BoProfileView() {
  const [context, setContext] = useState<BoContext | null>(null);
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
      setContext(body.data);
    })();
    return () => { current = false; };
  }, []);

  if (!context) return <section className={styles.page}><p>Đang tải hồ sơ…</p>{error ? <p className={styles.ownerError}>{error}</p> : null}</section>;

  const profile = context.staffProfile;
  const shortName = shortDisplayName(profile?.displayName ?? context.displayName);

  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · MY PROFILE</span>
      <h1>{shortName ? `Chào ${shortName}` : "Hồ sơ của tôi"}</h1>
      <p>Thông tin của chính tài khoản đang đăng nhập. Hồ sơ nhân sự và quyền truy cập chỉ đọc tại Back Office.</p>
    </header>

    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><h2>{profile?.displayName ?? context.displayName ?? "Tài khoản Back Office"}</h2><p>{context.email}</p></div>
        <span className={styles.readOnly}>{profile?.status ?? "account"}</span>
      </div>
      <div className={styles.formGrid}>
        <ReadFact label="Họ tên" value={profile?.displayName ?? context.displayName ?? "Chưa liên kết"} />
        <ReadFact label="Vai trò" value={profile?.roleLabel ?? "Chưa cập nhật"} />
        <ReadFact label="Bộ phận" value={profile?.department ?? "Chưa cập nhật"} />
        <ReadFact label="Loại nhân sự" value={profile?.employmentType ?? "Chưa cập nhật"} />
        <ReadFact label="Trạng thái Staff" value={profile?.status ?? "Chưa liên kết StaffMember"} />
        <ReadFact label="Email đăng nhập" value={context.email} />
        <ReadFact label="Email hồ sơ" value={profile?.profileEmail ?? "Chưa cập nhật"} />
        <ReadFact label="Điện thoại" value={profile?.mobile ?? "Chưa cập nhật"} />
        <ReadFact label="Địa chỉ" value={profile?.legalAddress ?? "Chưa cập nhật"} />
      </div>
      {!context.staffMemberId || !profile ? <p className={styles.staffWarning}>Tài khoản này chưa liên kết StaffMember. BO vẫn hoạt động theo quyền Access hiện hữu; tên không được suy đoán từ email.</p> : null}
      <p className={styles.ownerBulkStatus}>Để cập nhật thông tin cá nhân, dùng My Profile trên TOS. BO không dùng quyền Manager để tự sửa hồ sơ hay ACL.</p>
    </section>
  </section>;
}

function ReadFact({ label, value }: { label: string; value: string }) {
  return <div className={styles.field}><span>{label}</span><strong>{value}</strong></div>;
}
