"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createCameraStreamLease } from "@/lib/pap1612-camera-stream";
import styles from "./front-camera-evidence.module.css";
import {cameraReviewTransition,isTosCameraLocalReview,type CameraReviewAction,type CameraReviewStep} from "@/lib/pap1612-tos-camera-review";

function LiveFrontCameraEvidenceContent({ showConfirmation = false }: { showConfirmation?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [lease] = useState(() => createCameraStreamLease<MediaStream>());
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const stop = useCallback(() => { lease.release(); if (video.current) video.current.srcObject = null; }, [lease]);
  const start = useCallback(async () => {
    stop(); const token = lease.begin();
    await Promise.resolve();
    if (!lease.isCurrent(token)) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera cần HTTPS hoặc localhost. Không thể dùng ảnh thư viện.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "user" } }, audio: false });
      if (!lease.accept(token, media)) return;
      if (!video.current) { stop(); return; }
      video.current.srcObject = media;
      await video.current.play();
    } catch { if (lease.isCurrent(token)) { stop(); setError("Không thể mở camera trước. Kiểm tra quyền camera và thử lại."); } }
  }, [lease, stop]);
  useEffect(() => { let live = true; queueMicrotask(() => { if (live) void start(); }); return () => { live = false; stop(); }; }, [start, stop]);
  function capture() {
    if (!video.current?.srcObject || !video.current.videoWidth || !video.current.videoHeight) { setError("Camera chưa sẵn sàng."); return; }
    const canvas = document.createElement("canvas");
    const width = video.current.videoWidth; const height = video.current.videoHeight;
    const cropWidth = Math.min(width, height * 3 / 4);
    const cropHeight = Math.min(height, width * 4 / 3);
    canvas.width = 720; canvas.height = 960;
    const context = canvas.getContext("2d");
    if (!context) { setError("Không thể chụp ảnh. Vui lòng thử lại."); return; }
    context.drawImage(video.current, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    setError(""); setPhoto(canvas.toDataURL("image/jpeg", 0.86)); stop();
  }
  function retake() { setPhoto(""); void start(); }
  return <>
    <p>Đưa khuôn mặt và một phần không gian PINO vào cùng khung hình. Chỉ chụp trực tiếp bằng camera trước.</p>
    <video ref={video} autoPlay muted playsInline aria-label="Camera trước trực tiếp" className={photo ? styles.hiddenVideo : styles.video} />
    {photo && <img src={photo} alt="Ảnh vừa chụp" className={styles.preview} />}
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}>
      {!photo ? <button type="button" className={styles.primary} onClick={capture}>Chụp ảnh</button> : <button type="button" className={styles.primary} onClick={retake}>Chụp lại</button>}
      {error && !photo && <button type="button" className={styles.secondary} onClick={() => void start()}>Thử lại camera</button>}
      {showConfirmation && <button type="button" className={styles.secondary} disabled title="Chưa xác minh kết nối Core">Xác nhận ảnh</button>}
    </div>
    {photo && <p role="status">Ảnh chỉ được xem trước trên thiết bị. Chưa gửi bằng chứng hoặc ghi nhận giờ công.</p>}
  </>;
}

export function CameraReviewContent({onConfirm}:{onConfirm?:()=>void}={}){
 const [step,setStep]=useState<CameraReviewStep>("framing");

 function act(action:CameraReviewAction){
  const next=cameraReviewTransition(step,action);
  setStep(next);
  if(next==="confirmed"&&step!=="confirmed")onConfirm?.();
 }
 return <>
  <p>Đưa khuôn mặt và một phần không gian PINO vào cùng khung hình. Chỉ chụp trực tiếp bằng camera trước.</p>
  <div className={styles.video} role="img" aria-label="Khung hình camera mẫu" style={{display:"grid",placeItems:"center",color:"white",textAlign:"center"}}><span>{step==="framing"?"Khung hình mẫu camera trước":"Khung hình mẫu đã chụp"}</span></div>
  <p role="status">{step==="confirmed"?"Đã xác nhận trong phiên review. Không ghi nhận giờ công hoặc ảnh thật.":"Khung hình mô phỏng — camera thật cần kết nối HTTPS."}</p>
  <div className={styles.actions}>
   {step==="framing"?<button type="button" className={styles.primary} onClick={()=>act("capture")}>Chụp ảnh</button>:step==="preview"?<button type="button" className={styles.primary} onClick={()=>act("retake")}>Chụp lại</button>:null}
   <button type="button" className={styles.secondary} disabled={step!=="preview"} onClick={()=>act("confirm")}>Xác nhận ảnh</button>
  </div>
 </>;
}
function LocalFrontCameraEvidence({onConfirm}:{onConfirm?:()=>void}){
 if(typeof window==="undefined"||!isTosCameraLocalReview(location.origin,self.origin,location.pathname,location.search,location.hash))throw Error("Local camera review only");
 return <CameraReviewContent onConfirm={onConfirm}/>;
}
export function FrontCameraEvidenceContent({showConfirmation=false,localReview}:{showConfirmation?:boolean;localReview?:{onConfirm?:()=>void}}){
 return localReview?<LocalFrontCameraEvidence onConfirm={localReview.onConfirm}/>:<LiveFrontCameraEvidenceContent showConfirmation={showConfirmation}/>;
}
export default function FrontCameraEvidence({ onClose }: { onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label="Ảnh bằng chứng Check-in" className={styles.backdrop}>
    <section className={styles.sheet}>
      <h2>Ảnh bằng chứng Check-in</h2>
      <FrontCameraEvidenceContent />
      <button type="button" className={styles.secondary} onClick={onClose}>Đóng</button>
    </section>
  </div>;
}