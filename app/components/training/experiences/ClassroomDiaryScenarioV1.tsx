"use client";

import { useMemo, useState } from "react";
import {
  TRAINING_EXPERIENCE_CONTRACT_V1,
  type TrainingExperienceDefinition,
  type TrainingExperienceProps,
} from "@/lib/training-experience";
import styles from "./experience.module.css";

type Decision = "handoff" | "checkout" | "escalate" | "fabricate";

export function ClassroomDiaryScenarioV1({
  context,
  onSignal,
}: TrainingExperienceProps) {
  const [started, setStarted] = useState(false);
  const [decisionOne, setDecisionOne] = useState<Decision | null>(null);
  const [decisionTwo, setDecisionTwo] = useState<Decision | null>(null);
  const [checks, setChecks] = useState({ attendance: false, diary: false, evidence: false });
  const [requested, setRequested] = useState(false);

  const allChecked = Object.values(checks).every(Boolean);
  const safePath = decisionOne === "handoff" && decisionTwo === "escalate";
  const canComplete = started && safePath && allChecked;
  const completedCheckpointKeys = useMemo(
    () => new Set(context.completedCheckpointKeys),
    [context.completedCheckpointKeys],
  );

  async function start() {
    setStarted(true);
    await onSignal({ type: "STARTED" });
  }

  async function chooseOne(value: Decision) {
    setDecisionOne(value);
    if (value === "handoff") {
      await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "closing-sequence" });
    }
  }

  async function chooseTwo(value: Decision) {
    setDecisionTwo(value);
    if (value === "escalate") {
      await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "missing-evidence" });
    }
  }

  async function complete() {
    setRequested(true);
    await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "closing-confirmation" });
    await onSignal({ type: "COMPLETION_REQUESTED" });
  }

  return (
    <article className={styles.experience}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Scenario training · 7 phút</p>
        <h2>Classroom Diary: 19:28</h2>
        <p>
          Lớp vừa kết thúc. Phụ huynh đang chờ, một evidence còn thiếu và bạn chuẩn bị checkout.
          Chọn cách xử lý như trong ca làm thật.
        </p>
        <div className={styles.meta}>
          <span>{context.mode === "PREVIEW" ? "PREVIEW" : "STAFF"}</span>
          <span>Exact experience · rev 1</span>
        </div>
      </header>

      {!started ? (
        <section className={styles.stage}>
          <strong>Bắt đầu ca đóng lớp</strong>
          <p>Không có “lesson list”. Experience này đi thẳng vào tình huống.</p>
          <button className={styles.primary} type="button" onClick={() => void start()}>
            Vào tình huống
          </button>
        </section>
      ) : (
        <>
          <section className={styles.stage}>
            <div className={styles.step}>01</div>
            <h3>19:28 · Bạn còn 2 phút trước giờ checkout</h3>
            <p>Attendance đã xong nhưng Classroom Diary chưa handoff đủ evidence. Bạn làm gì?</p>
            <div className={styles.choices}>
              <button
                type="button"
                className={decisionOne === "handoff" ? styles.selected : ""}
                onClick={() => void chooseOne("handoff")}
              >
                Hoàn tất/handoff evidence trước khi checkout
              </button>
              <button
                type="button"
                className={decisionOne === "checkout" ? styles.selected : ""}
                onClick={() => void chooseOne("checkout")}
              >
                Checkout trước rồi quay lại bổ sung sau
              </button>
            </div>
            {decisionOne ? (
              <div className={decisionOne === "handoff" ? styles.good : styles.warn}>
                {decisionOne === "handoff"
                  ? "Đúng seam: checkout không được dùng để né closing obligation."
                  : "Chưa đạt: trạng thái timekeeping không thay thế nghĩa vụ closing của lớp."}
              </div>
            ) : null}
          </section>

          {decisionOne === "handoff" ? (
            <section className={styles.stage}>
              <div className={styles.step}>02</div>
              <h3>Một ảnh evidence chưa được chụp</h3>
              <p>Bạn không thể tái tạo evidence thật sau khi lớp đã kết thúc.</p>
              <div className={styles.choices}>
                <button
                  type="button"
                  className={decisionTwo === "escalate" ? styles.selected : ""}
                  onClick={() => void chooseTwo("escalate")}
                >
                  Ghi rõ thiếu evidence và escalation đúng owner
                </button>
                <button
                  type="button"
                  className={decisionTwo === "fabricate" ? styles.selected : ""}
                  onClick={() => void chooseTwo("fabricate")}
                >
                  Dùng ảnh cũ cho đủ record
                </button>
              </div>
              {decisionTwo ? (
                <div className={decisionTwo === "escalate" ? styles.good : styles.warn}>
                  {decisionTwo === "escalate"
                    ? "Đúng: transparency + escalation giữ provenance sạch."
                    : "Không đạt: training không bao giờ hướng Staff fabricate evidence."}
                </div>
              ) : null}
            </section>
          ) : null}

          {safePath ? (
            <section className={styles.stage}>
              <div className={styles.step}>03</div>
              <h3>Closing confirmation</h3>
              <p>Check nhanh trước khi gửi completion request.</p>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={checks.attendance}
                  onChange={(event) => setChecks((value) => ({ ...value, attendance: event.target.checked }))}
                />
                Attendance đã được xử lý theo owner
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={checks.diary}
                  onChange={(event) => setChecks((value) => ({ ...value, diary: event.target.checked }))}
                />
                Diary có trạng thái/handoff rõ ràng
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={checks.evidence}
                  onChange={(event) => setChecks((value) => ({ ...value, evidence: event.target.checked }))}
                />
                Thiếu evidence được ghi nhận trung thực
              </label>
              <button
                className={styles.primary}
                type="button"
                disabled={!canComplete || requested}
                onClick={() => void complete()}
              >
                {requested ? "Đã gửi completion request" : "Hoàn tất tình huống"}
              </button>
            </section>
          ) : null}
        </>
      )}

      {completedCheckpointKeys.size ? (
        <footer className={styles.resume}>
          Core đã ghi {completedCheckpointKeys.size} checkpoint từ lần trước. UI riêng tư khác không
          trở thành Workforce truth.
        </footer>
      ) : null}

      {requested ? (
        <div className={styles.finish}>
          <strong>Experience đã gửi yêu cầu hoàn tất.</strong>
          <p>
            Core mới là nơi quyết định COMPLETED, assessment, sign-off và qualification. Experience
            này không thể tự cấp chứng nhận.
          </p>
        </div>
      ) : null}
    </article>
  );
}

export const classroomDiaryScenarioV1: TrainingExperienceDefinition = {
  contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
  experienceKey: "classroom-diary-scenario",
  experienceRevision: 1,
  title: "Classroom Diary · Closing Scenario",
  summary: "Scenario ra quyết định trong closing flow thay vì lesson-template tuyến tính.",
  estimatedMinutes: 7,
  capabilities: ["scenario", "decision-feedback", "checkpoint", "completion-request"],
  Component: ClassroomDiaryScenarioV1,
};
