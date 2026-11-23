"use client";
import { useEffect, useRef, useState } from "react";

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
  return <div role="dialog" aria-modal="true" aria-label="Ảnh bằng chứng Check-in" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.65)",display:"grid",placeItems:"center",padding:16}}>
    <section style={{background:"#fff",color:"#292929",padding:20,borderRadius:16,width:"min(100%,430px)",display:"grid",gap:12}}>
      <h2>Ảnh bằng chứng Check-in</h2>
      <p>Đưa khuôn mặt và một phần không gian PINO vào cùng khung hình. Chỉ chụp trực tiếp bằng camera trước.</p>
      {<video ref={video} autoPlay muted playsInline aria-label="Camera trước trực tiếp" style={{width:"100%",borderRadius:12,background:"#222",display:photo ? "none" : "block"}} />}
      {photo && <img src={photo} alt="Ảnh vừa chụp" style={{width:"100%",borderRadius:12}} />}
      {error && <p role="alert">{error}</p>}
      <div style={{display:"flex",gap:8}}>
        {!photo ? <button type="button" onClick={capture}>Chụp ảnh</button> : <button type="button" onClick={retake}>Chụp lại</button>}
        <button type="button" onClick={() => { stop(); onClose(); }}>Đóng</button>
      </div>
      {photo && <p role="status">Ảnh chỉ được xem trước trên thiết bị. Chưa gửi bằng chứng hoặc ghi nhận giờ công; đang chờ tích hợp Core.</p>}
    </section>
  </div>;
}
