"use client";

import { useEffect, useState } from "react";
import {
  AfterschoolPinError,
  listAfterschoolStudents,
  logoutAfterschool,
  type AfterschoolStudent,
} from "../../../../lib/piner-afterschool-pin-client";
import css from "./login.module.css";

type StudentsState =
  | { status: "loading" | "error" | "expired" }
  | { status: "ready"; students: AfterschoolStudent[] };

export default function AfterschoolStudentPicker({
  csrfToken,
  onSignedOut,
}: {
  csrfToken: string;
  onSignedOut: () => void;
}) {
  const [result, setResult] = useState<StudentsState>({ status: "loading" });
  const [studentId, setStudentId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useEffect(() => {
    let current = true;
    listAfterschoolStudents().then(
      (students) => { if (current) { setResult({ status: "ready", students }); if (students.length === 1) setStudentId(students[0].id); } },
      (error: unknown) => {
        if (!current) return;
        const expired = error instanceof AfterschoolPinError && [401, 409].includes(error.status);
        setResult({ status: expired ? "expired" : "error" });
      },
    );
    return () => { current = false; };
  }, [attempt]);

  async function signOut() {
    setSigningOut(true);
    setLogoutError(false);
    try {
      await logoutAfterschool(csrfToken);
      onSignedOut();
    } catch (error) {
      if (error instanceof AfterschoolPinError && error.status === 401) onSignedOut();
      else setLogoutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  const selected = result.status === "ready"
    ? result.students.find((student) => student.id === studentId)
    : undefined;

  return <section className={css.card}>
    <h1>Chọn học viên</h1>
    {result.status === "loading" && <p role="status">Đang tải danh sách học viên…</p>}
    {result.status === "error" && <div>
      <p role="alert">Chưa tải được danh sách học viên.</p>
      <button type="button" onClick={() => {
        setResult({ status: "loading" });
        setAttempt((value) => value + 1);
      }}>Thử lại</button>
    </div>}
    {result.status === "expired" && <p role="alert">Phiên đã hết hạn. Vui lòng đăng nhập lại.</p>}
    {result.status === "ready" && (result.students.length ? <div className={css.form}>
      <label>Học viên
        <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">Chọn học viên</option>
          {result.students.map((student) => <option key={student.id} value={student.id}>
            {student.displayName}
          </option>)}
        </select>
      </label>
      {selected && <p>{selected.centers.map((center) => center.displayName).join(", ")}</p>}
    </div> : <p>Chưa có học viên được liên kết. Vui lòng liên hệ PINO.</p>)}
    {logoutError && <p role="alert">Chưa thể đăng xuất. Vui lòng thử lại.</p>}
    <button type="button" className={css.submit} disabled={signingOut}
      onClick={result.status === "expired" ? onSignedOut : signOut}>
      {result.status === "expired" ? "Đăng nhập lại" : "Đăng xuất"}
    </button>
  </section>;
}
