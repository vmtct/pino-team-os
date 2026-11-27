// PAP-2432: unmounted server-side presentation adapter. No access decision here.
// The caller must supply an authenticated Core page and admitted private media link builder.
const canonical=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const record=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const keys=(v,k)=>record(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const version=v=>Number.isSafeInteger(v)&&v>=2;
const instant=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const path=v=>typeof v==="string"&&/^\/(?!\/)[A-Za-z0-9_./%-]+$/.test(v)&&!v.includes("..")&&!/%(?:2e|2f|5c|25)/i.test(v)&&!/%(?![0-9a-f]{2})/i.test(v)&&!v.startsWith("/piner/posts/");
const labels={house:"PINO Afterschool",mytime:"MyTime by PINO"};
const date=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric"});
const denied=space=>({model:{space,state:"error",posts:[]},nextCursor:null});
export function projectPortfolioPage(space,page,privateMediaPath,serverScope){
 // Scope is server-owned and bound to the exact authorized Core request.
 if(!serverScope||serverScope.space!==space||serverScope.memberChrome?.runtime!==true)return denied(space);
 const selected=serverScope.memberChrome.selectedId;
 if(space==="house"&&(!canonical(serverScope.studentId)||selected!==serverScope.studentId||!Array.isArray(serverScope.memberChrome.students)||!serverScope.memberChrome.students.some(x=>x.id===selected)))return {model:{space,state:"no-profile",posts:[]},nextCursor:null};
 if(space==="mytime"&&serverScope.studentId!==null)return denied(space);
 const profileKey=space==="house"?selected:null;
 if(!Object.hasOwn(labels,space)||typeof privateMediaPath!=="function"||!keys(page,["items","nextCursor"])||!Array.isArray(page.items)||page.items.length>10)return denied(space);
 const seen=new Set(),mediaPaths=new Set(),posts=[];
 let previous=null;
 for(const item of page.items){
  if(!keys(item,["postId","editorialVersion","caption","occurredAt","media"])||!canonical(item.postId)||seen.has(item.postId)||!version(item.editorialVersion)||typeof item.caption!=="string"||!item.caption.trim()||item.caption.length>2000||!instant(item.occurredAt)||!Array.isArray(item.media)||item.media.length<1||item.media.length>5)return denied(space);
  if(previous&&(previous.occurredAt<item.occurredAt||(previous.occurredAt===item.occurredAt&&previous.postId<=item.postId)))return denied(space);
  const attachments=new Set(),media=[];
  for(const m of item.media){
   if(!keys(m,["attachmentId","position"])||!canonical(m.attachmentId)||attachments.has(m.attachmentId)||m.position!==media.length+1)return denied(space);
   let src;
   try{src=privateMediaPath(Object.freeze({space,postId:item.postId,editorialVersion:item.editorialVersion,attachmentId:m.attachmentId}));}catch{return denied(space);}
   if(!path(src)||mediaPaths.has(src))return denied(space);
   mediaPaths.add(src);
   attachments.add(m.attachmentId);media.push({src,alt:""});
  }
  seen.add(item.postId);previous=item;
  posts.push({space,key:item.postId,label:labels[space],publisherLabel:labels[space],date:date.format(new Date(item.occurredAt)),caption:item.caption,media});
 }
 const c=page.nextCursor;
 if(c!==null&&(!keys(c,["postId","occurredAt","editorialVersion"])||!previous||c.postId!==previous.postId||c.occurredAt!==previous.occurredAt||c.editorialVersion!==previous.editorialVersion))return denied(space);
 return {model:{space,profileKey,state:posts.length?"ready":"empty",posts},nextCursor:c===null?null:{postId:c.postId,occurredAt:c.occurredAt,editorialVersion:c.editorialVersion}};
}
