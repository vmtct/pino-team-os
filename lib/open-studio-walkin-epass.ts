/** PAP-1166 — render only a real, currently ASSIGNED walk-in Pass as shareable PNG.
 * No generated QR, payment claim, expiry, Parent PII or fabricated redemption.
 */
import type { WalkinPass } from "./open-studio-walkin-bo-api";

export function canExportWalkinEpass(pass:WalkinPass|null,centerId:string):pass is WalkinPass&{path_code:NonNullable<WalkinPass["path_code"]>} {
 return !!pass && pass.status==="ASSIGNED" && pass.center_id===centerId &&
  !!centerId && !!pass.parent_user_id && !!pass.code && !!pass.path_code;
}
const WIDTH=1080,HEIGHT=1350;
export async function exportWalkinEpassPng(pass:WalkinPass,centerId:string):Promise<"clipboard"|"download"> {
 if(!canExportWalkinEpass(pass,centerId))throw new Error("Pass không còn hợp lệ tại Center đang mở.");
 const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("Trình duyệt không hỗ trợ xuất ảnh.");
 ctx.fillStyle="#f7f4ff";ctx.fillRect(0,0,WIDTH,HEIGHT);
 ctx.fillStyle="#614d9c";ctx.fillRect(0,0,WIDTH,26);
 ctx.fillStyle="#fff";ctx.fillRect(68,94,944,1148);
 ctx.strokeStyle="#e4def5";ctx.lineWidth=3;ctx.strokeRect(68,94,944,1148);
 ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.fillStyle="#614d9c";ctx.font="bold 46px Arial, sans-serif";ctx.fillText("PINO HOUSE",540,222);
 ctx.font="26px Arial, sans-serif";ctx.fillText("TRẠM NGHỆ THUẬT",540,291);
 ctx.fillStyle="#222035";ctx.font="bold 58px Arial, sans-serif";ctx.fillText("PASS MỘT LƯỢT",540,430);
 ctx.fillStyle="#686578";ctx.font="26px Arial, sans-serif";ctx.fillText("Xuất trình mã tại quầy tiếp tân",540,505);
 ctx.fillStyle="#eee9fb";ctx.fillRect(140,600,800,218);
 ctx.fillStyle="#35265d";ctx.font="bold 43px monospace";ctx.fillText(pass.code,540,688,740);
 ctx.fillStyle="#63598b";ctx.font="25px Arial, sans-serif";ctx.fillText("MÃ PASS",540,770);
 ctx.fillStyle="#222035";ctx.font="bold 36px Arial, sans-serif";ctx.fillText("PATH: "+pass.path_code,540,904);
 ctx.strokeStyle="#e9e4f2";ctx.beginPath();ctx.moveTo(165,1020);ctx.lineTo(915,1020);ctx.stroke();
 ctx.fillStyle="#5a5768";ctx.font="24px Arial, sans-serif";ctx.fillText("Chỉ sử dụng một lần · Xác minh khi đến PINO",540,1080);
 ctx.fillText("Trạng thái Pass được kiểm tra trên hệ thống",540,1130);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error("Không thể tạo ảnh Pass.")),"image/png"));
 if(typeof ClipboardItem!=="undefined" && navigator.clipboard?.write) {
  try {await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);return "clipboard";}catch {/* fallback to PNG file */}
 }
 const url=URL.createObjectURL(blob);
 try {
  const a=document.createElement("a");a.href=url;a.download="PINO-Open-Studio-"+pass.code+".png";
  document.body.appendChild(a);a.click();a.remove();
 } finally {window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return "download";
}
