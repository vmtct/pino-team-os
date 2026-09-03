"use client";

import { useState } from "react";
import {
  TRAINING_EXPERIENCE_CONTRACT_V1,
  type TrainingExperienceDefinition,
  type TrainingExperienceProps,
} from "@/lib/training-experience";
import styles from "./experience.module.css";

type AngleChoice = "adult" | "eye-level";
type ContextChoice = "tight" | "story";

const scanItems = [
  ["light", "Mặt học viên sáng hơn background, không ngược sáng gắt"],
  ["moment", "Đang có hành động thật: vẽ, đàn, nhìn tác phẩm, tương tác"],
  ["clean", "Background sạch; bỏ chai nước, túi nilon, ghế thừa khỏi frame"],
  ["crop", "Không cắt ngang bàn tay, nhạc cụ hoặc tác phẩm một cách khó chịu"],
  ["privacy", "Người trong frame hợp lệ để chụp theo quy định hiện hành"],
] as const;

type ScanKey = (typeof scanItems)[number][0];

export function PinoPhotoMissionV1({ context, onSignal }: TrainingExperienceProps) {
  const [started, setStarted] = useState(false);
  const [angle, setAngle] = useState<AngleChoice | null>(null);
  const [brandContext, setBrandContext] = useState<ContextChoice | null>(null);
  const [scan, setScan] = useState<Record<ScanKey, boolean>>({
    light: false, moment: false, clean: false, crop: false, privacy: false,
  });
  const [requested, setRequested] = useState(false);

  const anglePassed = angle === "eye-level";
  const contextPassed = brandContext === "story";
  const scanPassed = scanItems.every(([key]) => scan[key]);
  const canComplete = anglePassed && contextPassed && scanPassed;

  async function start() {
    setStarted(true);
    await onSignal({ type: "STARTED" });
  }

  async function chooseAngle(value: AngleChoice) {
    setAngle(value);
    if (value === "eye-level") {
      await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "eye-level-story" });
    }
  }

  async function chooseContext(value: ContextChoice) {
    setBrandContext(value);
    if (value === "story") {
      await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "pino-context" });
    }
  }

  async function complete() {
    setRequested(true);
    await onSignal({ type: "CHECKPOINT_COMPLETED", checkpointKey: "pre-shutter-scan" });
    await onSignal({ type: "COMPLETION_REQUESTED" });
  }

  return (
    <article className={styles.experience}>
      <header className={`${styles.hero} ${styles.photoHero}`}>
        <p className={styles.kicker}>Photo mission · 8 phút</p>
        <h2>Chụp PINO đẹp</h2>
        <p>Bắt khoảnh khắc, không bắt tạo dáng. Mục tiêu là nhìn ảnh và cảm thấy “đang ở PINO”.</p>
        <div className={styles.photoPrinciples}>
          <span>01 · ngang tầm trẻ</span><span>02 · hành động thật</span>
          <span>03 · có bối cảnh</span><span>04 · frame sạch</span>
        </div>
      </header>

      {!started ? (
        <section className={styles.stage}>
          <strong>Mission: chọn được shot đáng giữ trong 10 giây.</strong>
          <p>Bạn không cần máy xịn. Training này tập mắt trước khi tập camera.</p>
          <button className={styles.primary} type="button" onClick={() => void start()}>Mở camera</button>
        </section>
      ) : null}

      {started ? (
        <section className={styles.stage}>
          <div className={styles.step}>01 · GÓC MÁY</div>
          <h3>Một học viên đang hoàn thiện tranh. Shot nào “có đời” hơn?</h3>
          <div className={styles.photoChoiceGrid}>
            <button type="button" className={angle === "adult" ? styles.photoSelected : ""} onClick={() => void chooseAngle("adult")}>
              <div className={`${styles.viewfinder} ${styles.highAngle}`}>
                <span className={styles.cameraTop}>A · đứng chụp từ trên xuống</span>
                <i className={styles.learnerHead} /><i className={styles.artBoard} /><i className={styles.clutterOne} />
              </div>
              <strong>Shot A</strong><small>Thấy “một đứa trẻ ở cái bàn”.</small>
            </button>
            <button type="button" className={angle === "eye-level" ? styles.photoSelected : ""} onClick={() => void chooseAngle("eye-level")}>
              <div className={`${styles.viewfinder} ${styles.eyeAngle}`}>
                <span className={styles.cameraTop}>B · ngang tầm mắt / tay</span>
                <i className={styles.learnerHead} /><i className={styles.artBoard} /><i className={styles.focusBox} />
              </div>
              <strong>Shot B</strong><small>Thấy mặt + tay + tác phẩm cùng kể chuyện.</small>
            </button>
          </div>
          {angle ? <div className={anglePassed ? styles.good : styles.warn}>{anglePassed
            ? "Đúng. Hạ camera xuống ngang tầm trẻ làm người xem bước vào hoạt động thay vì đứng ngoài quan sát."
            : "Chưa đẹp. Góc người lớn nhìn xuống thường làm trẻ nhỏ đi và background lấn át câu chuyện."}</div> : null}
        </section>
      ) : null}

      {anglePassed ? (
        <section className={styles.stage}>
          <div className={styles.step}>02 · “PINO” NẰM Ở ĐÂU?</div>
          <h3>Không cần dí logo vào giữa ảnh. Chọn lượng bối cảnh vừa đủ.</h3>
          <div className={styles.photoChoiceGrid}>
            <button type="button" className={brandContext === "tight" ? styles.photoSelected : ""} onClick={() => void chooseContext("tight")}>
              <div className={`${styles.viewfinder} ${styles.tightFrame}`}>
                <span className={styles.cameraTop}>A · zoom kín mặt</span><i className={styles.bigHead} />
              </div>
              <strong>Shot A</strong><small>Đẹp mặt, nhưng không biết đang ở đâu.</small>
            </button>
            <button type="button" className={brandContext === "story" ? styles.photoSelected : ""} onClick={() => void chooseContext("story")}>
              <div className={`${styles.viewfinder} ${styles.storyFrame}`}>
                <span className={styles.cameraTop}>B · giữ 25% context</span>
                <i className={styles.learnerHead} /><i className={styles.artBoard} /><i className={styles.brandStrip} /><i className={styles.focusBox} />
              </div>
              <strong>Shot B</strong><small>Nhân vật vẫn là chính; không gian PINO làm nền.</small>
            </button>
          </div>
          {brandContext ? <div className={contextPassed ? styles.good : styles.warn}>{contextPassed
            ? "Đúng. Một ít bàn học, vật liệu, màu không gian hoặc chi tiết nhận diện đủ để ảnh mang DNA PINO."
            : "Chưa đủ câu chuyện. Portrait quá kín dùng được, nhưng không phải shot tốt nhất để kể trải nghiệm PINO."}</div> : null}
        </section>
      ) : null}

      {contextPassed ? (
        <section className={styles.stage}>
          <div className={styles.step}>03 · SCAN TRƯỚC KHI BẤM</div>
          <h3>5 giây cuối: đừng sửa hậu kỳ thứ có thể sửa ngay trong frame.</h3>
          <p>Tick khi bạn đã chủ động kiểm tra từng điểm.</p>
          {scanItems.map(([key, label]) => (
            <label className={styles.check} key={key}>
              <input type="checkbox" checked={scan[key]} onChange={(event) => setScan((value) => ({ ...value, [key]: event.target.checked }))} />
              {label}
            </label>
          ))}
          <div className={styles.photoTip}><strong>Nhớ nhanh:</strong> Light → Moment → Context → Clean → Crop.</div>
          <button className={styles.primary} type="button" disabled={!canComplete || requested} onClick={() => void complete()}>
            {requested ? "Đã gửi completion request" : "Tôi sẵn sàng chụp"}
          </button>
        </section>
      ) : null}

      {requested ? (
        <div className={styles.finish}>
          <strong>Mission hoàn tất.</strong>
          <p>Ảnh đẹp ở PINO = trẻ là nhân vật chính, hoạt động là câu chuyện, PINO là bối cảnh — không phải ảnh pose cạnh logo.</p>
        </div>
      ) : null}
    </article>
  );
}

export const pinoPhotoMissionV1: TrainingExperienceDefinition = {
  contractVersion: TRAINING_EXPERIENCE_CONTRACT_V1,
  experienceKey: "pino-photo-mission",
  experienceRevision: 1,
  title: "Chụp PINO đẹp · Photo Mission",
  summary: "Visual decision training để Staff chụp học viên tự nhiên và giữ đúng cảm giác PINO.",
  estimatedMinutes: 8,
  capabilities: ["visual-comparison", "decision-feedback", "pre-shutter-scan", "completion-request"],
  Component: PinoPhotoMissionV1,
};
