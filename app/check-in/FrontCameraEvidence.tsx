"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./front-camera-evidence.module.css";

export default function FrontCameraEvidence({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  async function start() {
    stop(); setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera cần HTTPS hoặc localhost. Không thể dùng ảnh thư viện.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } }, audio: false });
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    } catch { stop(); setError("Không thể mở camera trước. Kiểm tra quyền camera và thử lại."); }
  }
  useEffect(() => { void start(); return () => stop(); }, []);
  function capture() {
    if (!video.current?.videoWidth) { setError("Camera chưa sẵn sàng."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    setPhoto(canvas.toDataURL("image/jpeg", 0.86)); stop();
  }
  function retake() { setPhoto(""); void start(); }
  return <div role="dialog" aria-modal="true" aria-label="Ảnh bằng chứng Check-in" className={styles.backdrop}>
    <section className={styles.sheet}>
      <h2>Ảnh bằng chứng Check-in</h2>
      <p>Đưa khuôn mặt và một phần không gian PINO vào cùng khung hình. Chỉ chụp trực tiếp bằng camera trước.</p>
      {<video ref={video} autoPlay muted playsInline aria-label="Camera trước trực tiếp" className={photo ? styles.hiddenVideo : styles.video} />}
      {photo && <img src={photo} alt="Ảnh vừa chụp" className={styles.preview} />}
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        {!photo ? <button type="button" className={styles.primary} onClick={capture}>Chụp ảnh</button> : <button type="button" className={styles.primary} onClick={retake}>Chụp lại</button>}
        <button type="button" className={styles.secondary} onClick={() => { stop(); onClose(); }}>Đóng</button>
      </div>
      {photo && <p role="status">Ảnh chỉ được xem trước trên thiết bị. Chưa gửi bằng chứng hoặc ghi nhận giờ công; đang chờ tích hợp Core.</p>}
    </section>
  </div>;
}
