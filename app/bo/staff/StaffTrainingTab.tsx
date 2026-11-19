"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { TrainingAssignmentDetail } from "@/lib/training-model";
import styles from "../bo.module.css";

type TrainingState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: TrainingAssignmentDetail[] };

/** PAP-788: read canonical Staff-scoped training, not an invented promotion/pay ledger. */
export function StaffTrainingTab({ staffId }: { staffId: string }) {
  const [state, setState] = useState<TrainingState>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    void boApi.trainingStaffAssignments(staffId)
      .then((items) => { if (active) setState({ status: "ready", items }); })
      .catch((cause) => {
        if (active) setState({
          status: "error",
          message: cause instanceof Error ? cause.message : "Không thể tải hồ sơ đào tạo của Staff.",
        });
      });
    return () => { active = false; };
  }, [staffId, retry]);

  return <section className={styles.panel} data-testid="staff-v2-training">
    <div className={styles.panelHeading}>
      <div><h2>Năng lực & đào tạo</h2><p>Training assignments canonical của Staff đang xem; khóa năng lực khác với quyết định tăng lương.</p></div>
      <span className={styles.readOnly}>read only</span>
    </div>
    <p>Staff ID: <code>{staffId}</code></p>
    {state.status === "loading" ? <p role="status">Đang tải Training assignments…</p> : null}
    {state.status === "error" ? <div role="alert" className={styles.staffPinoriaUnavailable}>
      <p>Không thể đọc Training trong phạm vi quyền hiện tại: {state.message}</p>
      <button type="button" className={styles.secondaryButton} onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
    </div> : null}
    {state.status === "ready" && state.items.length === 0 ? <p>Staff này chưa có Training assignment được xác minh.</p> : null}
    {state.status === "ready" && state.items.length > 0 ? <div className={styles.staffAssignmentList}>
      {state.items.map((item) => <article className={styles.staffAssignmentCard} key={item.assignment.id}>
        <div>
          <strong>{item.version.title}</strong>
          <small>{item.version.track ?? "Chưa khai báo track"} · v{item.version.versionNumber}</small>
          <small>Assignment: {item.assignment.status} · {item.assignment.dueDate ? `Hạn ${item.assignment.dueDate}` : "Không có hạn"}</small>
          <small>Assessment: {item.latestAssessment
            ? `${item.latestAssessment.passed ? "Đạt" : "Chưa đạt"} · ${item.latestAssessment.score}`
            : "Chưa có kết quả đánh giá"}</small>
          <small>Sign-off: {item.signOff ? `Đã duyệt · ${new Date(item.signOff.signedOffAt).toLocaleString("vi-VN")}` : item.version.requiresSignoff ? "Chưa duyệt" : "Không yêu cầu"}</small>
          <small>Năng lực: {item.qualification ? `${item.qualification.qualificationCode} · ${item.qualification.status}` : "Chưa ghi nhận qualification"}</small>
        </div>
      </article>)}
    </div> : null}
    <div className={styles.staffActions}>
      <Link className={styles.secondaryButton} href="/bo/training">Mở BO Training để phân công và duyệt</Link>
    </div>
    <p className={styles.readOnly}>Không tự nâng hạng, điều chỉnh lương hay tự suy diễn tiến độ từ bài học.</p>
  </section>;
}
