/** PAP-1313: photograph is an operational prerequisite; only a durable Core receipt
 * (NOT local file selection) authorizes the subsequent consume API call.
 */
export const MAX_EPASS_IMAGE_BYTES=8*1024*1024;
export function ePassPhotoError(file:Pick<Blob,"size"|"type">|null):string|null{
 if(!file)return "Bắt buộc chụp ảnh e-pass từ tin nhắn PINO trước khi sử dụng Pass.";
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))
  return "Chỉ nhận ảnh JPEG, PNG hoặc WebP.";
 if(file.size<1||file.size>MAX_EPASS_IMAGE_BYTES)
  return "Ảnh e-pass phải có dung lượng từ 1 byte đến 8 MB.";
 return null;
}
export function hasRequiredEPassPhoto(file:Pick<Blob,"size"|"type">|null,consent:boolean):boolean{
 return consent===true&&ePassPhotoError(file)===null;
}
export function readEPassPhotoBase64(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Không đọc được ảnh e-pass; hãy chụp lại."));
  reader.onload=()=>{
   const result=reader.result;
   const match=typeof result==="string"?/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(result):null;
   if(!match){reject(new Error("Định dạng ảnh e-pass không hợp lệ."));return;}
   resolve(match[1]!);
  };
  reader.readAsDataURL(file);
 });
}
