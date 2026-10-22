"use client";
import {useEffect,useRef,useState} from "react";
import styles from "./check-in-camera.module.css";
type CameraProps={busy:boolean;onCancel:()=>void;onConfirm:(blob:Blob)=>Promise<void>};
const MAX_BYTES=350*1024;

async function canvasJpeg(canvas:HTMLCanvasElement,quality:number):Promise<Blob>{
 return new Promise((resolve,reject)=>canvas.toBlob(
  blob=>blob?resolve(blob):reject(new Error("Không thể tạo ảnh JPEG từ camera.")),
  "image/jpeg",quality,
 ));
}
async function takePhoto(video:HTMLVideoElement):Promise<Blob>{
 if(!video.videoWidth||!video.videoHeight)throw new Error("Camera chưa sẵn sàng.");
 const canvas=document.createElement("canvas");
 let factor=Math.min(1,1280/video.videoWidth),quality=0.78;
 for(let n=0;n<6;n++){
  canvas.width=Math.max(320,Math.round(video.videoWidth*factor));
  canvas.height=Math.max(240,Math.round(video.videoHeight*factor));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Canvas không khả dụng.");
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const blob=await canvasJpeg(canvas,quality);
  if(blob.size>=128&&blob.size<=MAX_BYTES)return blob;
  factor*=0.84;quality=Math.max(0.48,quality-0.065);
 }
 throw new Error("Ảnh quá lớn. Hãy thử chụp lại.");
}
/** getUserMedia only. No gallery/file input, photo bytes never enter localStorage. */
export function CheckInCameraPanel({busy,onCancel,onConfirm}:CameraProps){
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const streamRef=useRef<MediaStream|null>(null);
 const [revision,setRevision]=useState(0);
 const [error,setError]=useState("");
 const [phase,setPhase]=useState<"starting"|"live"|"captured">("starting");
 const [photo,setPhoto]=useState<Blob|null>(null);
 const [preview,setPreview]=useState("");
 function stop(){streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;}
 useEffect(()=>{
  let valid=true;const video=videoRef.current;
  if(!navigator.mediaDevices?.getUserMedia){
   setError("Camera chỉ hoạt động qua HTTPS/localhost. Hãy mở PINO TOS bằng địa chỉ bảo mật.");
   return;
  }
  void navigator.mediaDevices.getUserMedia({audio:false,
    video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:960}},
  }).then(stream=>{
   if(!valid){stream.getTracks().forEach(t=>t.stop());return;}
   streamRef.current=stream;
   if(video){video.srcObject=stream;void video.play().catch(()=>setError("Không thể bắt đầu camera."));}
   setPhase("live");
  }).catch(()=>{if(valid)setError("Không được cấp quyền camera hoặc camera không khả dụng.");});
  return ()=>{valid=false;stop();};
 },[revision]);
 useEffect(()=>{
  if(!photo){setPreview("");return;}
  const uri=URL.createObjectURL(photo);setPreview(uri);
  return ()=>URL.revokeObjectURL(uri);
 },[photo]);
 async function capture(){
  if(!videoRef.current||phase!=="live")return;
  try{setError("");const blob=await takePhoto(videoRef.current);stop();setPhoto(blob);setPhase("captured");}
  catch(cause){setError(cause instanceof Error?cause.message:"Không thể chụp ảnh.");}
 }
 function retake(){setError("");setPhoto(null);setPhase("starting");setRevision(x=>x+1);}
 return <section className={styles.panel} aria-label="Bằng chứng camera Check-in">
   <div className={styles.heading}><strong>◉ Bằng chứng Check-in</strong><small>1 ảnh trực tiếp · Không có chọn thư viện</small></div>
   <p>Chụp góc trung tâm có dấu hiệu PINO. Tránh chụp học viên và thông tin riêng tư.</p>
   <div className={styles.frame}>
     <video ref={videoRef} autoPlay playsInline muted className={phase==="captured"?styles.hidden:styles.video}/>
     {photo&&preview?<img src={preview} alt="Ảnh Check-in vừa chụp" className={styles.preview}/>:null}
     {phase==="starting"&&!error?<span className={styles.placeholder}>Đang mở camera…</span>:null}
   </div>
   {error?<div className={styles.error} role="alert">{error}<p>Chưa được phép Check-in không ảnh. Liên hệ quản lý để xử lý ngoại lệ.</p></div>:null}
   <div className={styles.actions}>
    {phase==="live"?<button type="button" disabled={busy} onClick={()=>void capture()}>◉ Chụp ảnh</button>:null}
    {phase==="captured"?<>
      <button type="button" className={styles.minor} disabled={busy} onClick={retake}>↺ Chụp lại</button>
      <button type="button" disabled={busy||!photo} onClick={()=>photo&&void onConfirm(photo)}>
       {busy?"Đang gửi bằng chứng…":"Xác nhận ảnh & Check-in"}
      </button>
    </>:null}
    {error?<button type="button" className={styles.minor} onClick={retake}>Thử camera lại</button>:null}
    <button type="button" className={styles.minor} disabled={busy} onClick={onCancel}>Hủy</button>
   </div>
   <small className={styles.note}>Ảnh được giữ riêng tư để người quản lý đối soát khi chốt lương. Bản triển khai lưu ảnh tối đa 15 ngày sau khi chốt riêng nhân viên.</small>
 </section>;
}
