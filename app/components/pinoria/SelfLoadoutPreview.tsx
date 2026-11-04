"use client";
/** PAP-1356 / PAP-1456 / Epic PAP-1097 / PNR-WARD: shareable Core Self character composition.
 * PINO DS owns A/B responsive columns and chrome. Canvas owns ONLY dynamic pixels;
 * no module stylesheet, inline CSS, synthetic Item, arbitrary R2 key or z editing.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

const SLOTS=["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"] as const;
type Slot=typeof SLOTS[number];
type Snapshot={itemId:string;displayName:string;positionX:number;positionY:number;scale:number;rotationDegrees:number|null};
type PreviewData={version:number;slots:Record<Slot,Snapshot|null>;renderStack:readonly string[]};
const isSlot=(layer:string):layer is Slot=>(SLOTS as readonly string[]).includes(layer);
const BASE_URL="https://assets.pinohouse.art/pinoria/char-base.png"; // S1 public asset: verified 200 image/png.
const WIDTH=270, HEIGHT=480; // Portrait 9:16; geometry is rendering, not DS color/style policy.

function safe(item:Snapshot):boolean {
  return Number.isFinite(item.positionX)&&item.positionX>=-1&&item.positionX<=1 &&
    Number.isFinite(item.positionY)&&item.positionY>=-1&&item.positionY<=1 &&
    Number.isFinite(item.scale)&&item.scale>0&&item.scale<=10 &&
    (item.rotationDegrees===null||(Number.isFinite(item.rotationDegrees)&&item.rotationDegrees>=-360&&item.rotationDegrees<=360));
}
function imageFrom(src:string,signal:AbortSignal):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.decoding="async";
    const clear=()=>{img.onload=null;img.onerror=null;signal.removeEventListener("abort",abort);};
    const abort=()=>{clear();img.src="";reject(new Error("ABORTED"));};
    img.onload=()=>{clear();resolve(img);};
    img.onerror=()=>{clear();reject(new Error("MEDIA_UNAVAILABLE"));};
    signal.addEventListener("abort",abort,{once:true});
    if(signal.aborted){abort();return;}
    // Same-origin BO media carries Staff cookie automatically; public base is freely readable.
    img.src=src;
  });
}

/** Bounded, format-independent check of decoded foreground pixels (PNG/WebP/etc.).
 * Keep this canvas separate: the public CHAR_BASE can taint the display canvas.
 * This is a suitability sample, not a full-image transparency certification.
 */
function opaqueForeground(img:HTMLImageElement):boolean {
  const sample=document.createElement("canvas");
  sample.width=8;sample.height=8;
  const ctx=sample.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw new Error("ALPHA_SAMPLE_UNAVAILABLE");
  ctx.drawImage(img,0,0,8,8);
  const pixels=ctx.getImageData(0,0,8,8).data;
  for(let alpha=3;alpha<pixels.length;alpha+=4){
    if(pixels[alpha]!==255)return false;
  }
  return true;
}

export function SelfLoadoutEditorLayout({preview,children}:{preview:ReactNode;children:ReactNode}){
  return <div className="pds-properties" data-pds-variant="detail">
    <div className="pds-property-grid">{preview}<div className="pds-property-section">{children}</div></div>
  </div>;
}

/** Render the immutable Core layer order. BO and TV may supply different authorized slot URLs. */
export function SelfLoadoutPreview({loadout,mediaSrc}:{
  loadout:PreviewData|null;mediaSrc:(slot:Slot)=>string;
}){
  const canvas=useRef<HTMLCanvasElement|null>(null);
  const [missing,setMissing]=useState<string[]>([]);
  const [mediaWarnings,setMediaWarnings]=useState<{opaque:string[];unchecked:string[]}>({opaque:[],unchecked:[]});
  useEffect(()=>{
    const target=canvas.current;
    if(!target||!loadout)return;
    const ctx=target.getContext("2d");
    if(!ctx)return;
    const ctl=new AbortController();
    const draw=async()=>{
      ctx.clearRect(0,0,WIDTH,HEIGHT);
      const unavailable:string[]=[];
      const opaque:string[]=[],unchecked:string[]=[];
      let afterBase=false;
      for(const layer of loadout.renderStack){
        if(ctl.signal.aborted)return;
        const base=layer==="CHAR_BASE";
        if(base)afterBase=true;
        if(!base&&!isSlot(layer))continue;
        const item=base?null:loadout.slots[layer as Slot];
        if(!base&&!item)continue;
        if(item&&!safe(item)){unavailable.push(layer);continue;}
        try{
          const url=base?BASE_URL:mediaSrc(layer as Slot);
          // A renderer is never allowed to send session cookies to an unknown media host.
          if(!base&&new URL(url,window.location.href).origin!==window.location.origin){
            unavailable.push(layer);continue;
          }
          const img=await imageFrom(url,ctl.signal);
          if(ctl.signal.aborted)return;
          if(!base&&afterBase&&layer!=="AURA_GROUND"&&layer!=="AURA_BACK"){
            try{
              if(opaqueForeground(img)){opaque.push(layer);continue;}
            }catch{
              unchecked.push(layer);continue;
            }
          }
          ctx.save();
          if(base){
            ctx.globalAlpha=.35; // S1 confirmed CHAR_BASE treatment.
            ctx.drawImage(img,0,0,WIDTH,HEIGHT);
          } else if(item){
            ctx.translate(WIDTH/2+(item.positionX*WIDTH)/2,HEIGHT/2+(item.positionY*HEIGHT)/2);
            ctx.rotate(((item.rotationDegrees??0)*Math.PI)/180);
            ctx.scale(item.scale,item.scale);
            ctx.drawImage(img,-WIDTH/2,-HEIGHT/2,WIDTH,HEIGHT);
          }
          ctx.restore();
        }catch{
          if(ctl.signal.aborted)return;
          unavailable.push(layer);
        }
      }
      if(!ctl.signal.aborted){setMissing(unavailable);setMediaWarnings({opaque,unchecked});}
    };
    void draw();
    return ()=>ctl.abort();
  },[loadout,mediaSrc]);
  return <figure className="pds-property-section" aria-label="Composition Preview">
    <h3 className="pds-property-heading">Composition Preview</h3>
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Pinoria Self: 9:16 theo các lớp đã lưu">
      Không hỗ trợ Canvas để hiển thị Self.
    </canvas>
    <figcaption className="pds-property-text">
      Preview từ trạng thái đã lưu trên Core, không tự cấp Item và không áp dụng Set S6.
      {missing.length>0&&<p role="alert">Chưa tải được: {missing.join(", ")} (Core media PAP-1428 / quyền Center).</p>}
      {mediaWarnings.opaque.length>0&&<p role="alert">Item media không phù hợp để ghép lớp (opaque: mẫu alpha không có vùng trong suốt): {mediaWarnings.opaque.join(", ")}. Đã bỏ qua hình trong preview để không che Self; trang bị đã lưu không thay đổi.</p>}
      {mediaWarnings.unchecked.length>0&&<p role="alert">Không kiểm tra được độ trong suốt của Item media: {mediaWarnings.unchecked.join(", ")}. Đã bỏ qua hình trong preview; trang bị đã lưu không thay đổi.</p>}
    </figcaption>
  </figure>;
}
