/** PAP-2386: immutable pending order must match the authorized READY listing. */
export function verifiedSubmittedOrder(ids:readonly string[]|null,version:number,listing:{postVersion:number;mediaCount:number;attachments:readonly {id:string;state:string}[]}):string[]{
 if(!ids||version!==listing.postVersion||ids.length<1||ids.length>5||ids.length!==listing.mediaCount||ids.length!==listing.attachments.length||new Set(ids).size!==ids.length||listing.attachments.some(a=>a.state!=="READY"||!ids.includes(a.id)))throw Error("Không xác minh được thứ tự ảnh đã gửi.");
 return [...ids];
}
export async function clipboardPng(blob:Blob):Promise<Blob>{
 if(blob.type==="image/png")return blob;
 if(!["image/jpeg","image/webp"].includes(blob.type))throw Error("Ảnh không hợp lệ.");
 const image=await createImageBitmap(blob);
 try{
  if(image.width<1||image.height<1||image.width*image.height>16000000)throw Error("Ảnh quá lớn.");
  const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw Error("Không thể sao chép ảnh.");
  ctx.drawImage(image,0,0);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("Không thể sao chép ảnh.")),"image/png"));
 }finally{image.close();}
}
