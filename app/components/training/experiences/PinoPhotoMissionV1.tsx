"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_EXPERIENCE_CONTRACT_V1,
  type TrainingArtifactReceipt,
  type TrainingExperienceDefinition,
  type TrainingExperienceProps,
} from "@/lib/training-experience";
import styles from "./experience.module.css";

type ShotChoice = "A" | "B";

type SubmissionState = {
  receipt: TrainingArtifactReceipt;
  fileName: string;
  previewUrl: string;
};

const scanItems = [
  "Ánh sáng đủ và mặt trẻ không bị chìm",
  "Khoảnh khắc thật, không ép tạo dáng",
  "Background sạch, không có vật thừa gây xao nhãng",
  "Crop không cắt tay, đầu hoặc tác phẩm khó chịu",
  "Đã kiểm tra eligibility/privacy theo rule hiện hành",
] as const;

export function PinoPhotoMissionV1({ context, onSignal, onArtifactSubmit }: TrainingExperienceProps) {
  const [started, setStarted] = useState(false);
  const [angle, setAngle] = useState<ShotChoice | null>(null);
  const [contextChoice, setContextChoice] = useState<ShotChoice | null>(null);
  const [checks, setChecks] = useState<boolean[]>(scanItems.map(() => false));
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [submission, setSubmission] = useState<SubmissionState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [completionRequested, setCompletionRequested] = useState(false);

  const review = context.artifactSubmissions?.find((item) => item.submissionKey === "photo-practice") ?? null;
  const learned = angle === "B" && contextChoice === "B";
  const allChecked = checks.every(Boolean);
  const readyToSubmit = learned && allChecked && Boolean(file) && !submission;
  const readyToComplete = review?.status === "PASS" && !completionRequested;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function start() {
    setStarted(true);
    await onSignal({ type: "STARTED" });
  }

  async function chooseAngle(value: ShotChoice) {
    setAngle(value);
    if (value === "B") await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "eye-level-story" });
  }
  async function chooseContext(value: ShotChoice) {
    setContextChoice(value);
    if (value === "B") await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "pino-context" });
  }

  async function submitPhoto() {
    if (!file || !onArtifactSubmit) {
      setError("Submission adapter chưa sẵn sàng cho experience này.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "pre-shutter-scan" });
      const receipt = await onArtifactSubmit({ submissionKey: "photo-practice", kind: "IMAGE", file });
      setSubmission({ receipt, fileName: file.name, previewUrl });
      await onSignal({ type: "SUBMISSION_CREATED", submissionId: receipt.submissionId, submissionKey: receipt.submissionKey });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể submit ảnh.");
    } finally {
      setUploading(false);
    }
  }

  function retryPhoto() {
    setFile(null);
    setPreviewUrl("");
    setSubmission(null);
    setCompletionRequested(false);
  }
  async function requestCompletion() {
    if (review?.status !== "PASS") return;
    setCompletionRequested(true);
    await onSignal({ type: "COMPLETION_REQUESTED" });
  }

  const selectedFileLabel = useMemo(() => file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "Chưa chọn ảnh", [file]);

  return (
    <article className={styles.experience}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Photo mission · 8 phút</p>
        <h2>Chụp PINO đẹp</h2>
        <p>Bắt khoảnh khắc, không bắt tạo dáng. Mục tiêu là nhìn ảnh và cảm thấy “đang ở PINO”.</p>
        <div className={styles.meta}>
          <span>01 · ngang tầm trẻ</span>
          <span>02 · hành động thật</span>
          <span>03 · có bối cảnh</span>
          <span>04 · frame sạch</span>
        </div>
      </header>

      {!started ? (
        <section className={styles.stage}>
          <strong>Mission: chọn được shot đáng giữ trong 10 giây.</strong>
          <p>Bạn không cần máy xịn. Training này tập mắt trước khi tập camera.</p>
          <button className={styles.primary} type="button" onClick={() => void start()}>Mở camera</button>
        </section>
      ) : (
        <>
          <section className={styles.stage}>
            <div className={styles.step}>01 · CAMERA HEIGHT</div>
            <h3>Học viên đang vẽ, bạn chọn góc nào?</h3>
            <div className={styles.shotGrid}>
              <button type="button" className={angle === "A" ? styles.selectedShot : styles.shot} onClick={() => void chooseAngle("A")}>
                <span className={`${styles.viewfinder} ${styles.viewfinderHigh}`}><i /><b>Shot A</b></span>
                <strong>Đứng cao chụp xuống</strong>
                <small>Thấy bàn và đầu trẻ nhiều hơn biểu cảm.</small>
              </button>
              <button type="button" className={angle === "B" ? styles.selectedShot : styles.shot} onClick={() => void chooseAngle("B")}>
                <span className={`${styles.viewfinder} ${styles.viewfinderEye}`}><i /><b>Shot B</b></span>
                <strong>Hạ ngang tầm trẻ</strong>
                <small>Thấy mắt, tay và tác phẩm cùng lúc.</small>
              </button>
            </div>
            {angle ? <div className={angle === "B" ? styles.good : styles.warn}>
              {angle === "B" ? "Hạ camera xuống ngang tầm trẻ: ảnh có người, hành động và cảm xúc." : "Ảnh đủ để document, nhưng chưa kể được câu chuyện của học viên."}
            </div> : null}
          </section>
          {angle === "B" ? <section className={styles.stage}>
            <div className={styles.step}>02 · PINO CONTEXT</div>
            <h3>Giữ bao nhiêu bối cảnh?</h3>
            <div className={styles.shotGrid}>
              <button type="button" className={contextChoice === "A" ? styles.selectedShot : styles.shot} onClick={() => void chooseContext("A")}>
                <span className={`${styles.viewfinder} ${styles.viewfinderTight}`}><i /><b>Shot A</b></span>
                <strong>Crop thật sát</strong>
                <small>Đẹp như portrait nhưng không biết đang ở đâu.</small>
              </button>
              <button type="button" className={contextChoice === "B" ? styles.selectedShot : styles.shot} onClick={() => void chooseContext("B")}>
                <span className={`${styles.viewfinder} ${styles.viewfinderContext}`}><i /><b>Shot B</b></span>
                <strong>Giữ 20–30% bối cảnh</strong>
                <small>Thấy vật liệu, bàn học hoặc một dấu hiệu PINO vừa đủ.</small>
              </button>
            </div>
            {contextChoice ? <div className={contextChoice === "B" ? styles.good : styles.warn}>
              {contextChoice === "B" ? "Một ít bàn học, vật liệu hoặc không gian đủ để ảnh có PINO context mà không lấn nhân vật chính." : "Portrait có thể đẹp, nhưng thiếu context sẽ khó kể câu chuyện PINO."}
            </div> : null}
          </section> : null}
          {learned ? <section className={styles.stage}>
            <div className={styles.step}>03 · PRE-SHUTTER SCAN</div>
            <h3>5 điểm trước khi bấm</h3>
            <p>Tick như một thói quen 5 giây, không phải checklist hành chính.</p>
            {scanItems.map((item, index) => (
              <label className={styles.check} key={item}>
                <input type="checkbox" checked={checks[index]} onChange={(event) => setChecks((items) => items.map((value, i) => i === index ? event.target.checked : value))} />
                {item}
              </label>
            ))}
          </section> : null}

          {learned && allChecked ? <section className={styles.stage}>
            <div className={styles.step}>04 · PHOTO EVIDENCE</div>
            <h3>Chụp một ảnh thật của PINO</h3>
            <p>Áp dụng ngay những gì vừa học. Trên điện thoại, nút này có thể mở camera sau.</p>
            <label className={styles.uploadBox}>
              <input data-testid="photo-input" type="file" accept="image/*" capture="environment" disabled={Boolean(submission)}
                onChange={(event) => { setFile(event.target.files?.[0] ?? null); setSubmission(null); setError(""); }} />
              <strong>{submission ? "Ảnh đã submit" : "Chụp / chọn ảnh"}</strong>
              <small>{submission?.fileName ?? selectedFileLabel}</small>
            </label>
            {previewUrl ? <div className={styles.photoPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Ảnh training Staff chuẩn bị submit" />
              <span>Preview · training evidence</span>
            </div> : null}
            {error ? <div className={styles.warn}>{error}</div> : null}
            {!submission ? <button className={styles.primary} type="button" disabled={!readyToSubmit || uploading} onClick={() => void submitPhoto()}>
              {uploading ? "Đang submit…" : "Submit để Manager review"}
            </button> : null}

            {review?.status === "WAITING_REVIEW" ? <div className={styles.reviewState}>
              <strong>WAITING REVIEW</strong>
              <span>Submission {review.submissionId}</span>
              <p>Manager chưa đánh giá. Completion đang khóa.</p>
            </div> : null}
            {review?.status === "RETRY" ? <div className={styles.retryState}>
              <strong>NEEDS RETRY</strong>
              <p>{review.feedback || "Manager yêu cầu chụp lại."}</p>
              <button className={styles.secondaryAction} type="button" onClick={retryPhoto}>Chụp lại</button>
            </div> : null}
            {review?.status === "PASS" ? <div className={styles.passState}>
              <strong>PHOTO PASS</strong>
              <p>{review.feedback || "Ảnh đạt yêu cầu thực hành."}</p>
            </div> : null}
          </section> : null}
          {review?.status === "PASS" ? <section className={styles.stage}>
            <div className={styles.step}>05 · COMPLETION</div>
            <h3>Manager đã duyệt ảnh</h3>
            <p>Review PASS mới mở completion request.</p>
            <button className={styles.primary} type="button" disabled={!readyToComplete} onClick={() => void requestCompletion()}>
              {completionRequested ? "Đã gửi completion request" : "Hoàn tất training"}
            </button>
          </section> : null}
        </>
      )}

      {completionRequested ? <div className={styles.finish}>
        <strong>Mission hoàn tất.</strong>
        <p>Core mới là nơi quyết định COMPLETED/sign-off/qualification.</p>
      </div> : null}

      {context.completedCheckpointKeys.length ? <footer className={styles.resume}>
        Core đã giữ {context.completedCheckpointKeys.length} checkpoint từ lần trước.
      </footer> : null}
    </article>
  );
}
export const pinoPhotoMissionV1: TrainingExperienceDefinition = {
  contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
  experienceKey: "pino-photo-mission",
  experienceRevision: 1,
  title: "Chụp PINO đẹp · Photo Mission",
  summary: "Visual mission: chọn frame, pre-shutter scan, submit ảnh thật và chờ Manager review.",
  estimatedMinutes: 8,
  capabilities: ["visual-compare", "photo-capture", "artifact-submission", "manager-review", "checkpoint", "completion-request"],
  Component: PinoPhotoMissionV1,
};
