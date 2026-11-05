// PAP-1421: pure path and verb admission; never a permission grant.
const root="billing/bill-drafts";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const item=new RegExp(`^${root}/(${uuid})(?:/(issue-preview|issue|items)(?:/(${uuid}))?)?$`,"i");
const list=new RegExp(`^${root}/center/(${uuid})$`,"i");
export function isBoBillsPath(path:string):boolean{return path===root||path.startsWith(root+"/");}
export function billMethodAllowed(path:string,method:string):boolean{
 if(path===root)return method==="POST";
 if(list.test(path))return method==="GET";
 const m=item.exec(path);if(!m)return false;
 if(!m[2])return method==="GET"||method==="PATCH";
 if(m[2]==="issue-preview")return !m[3]&&method==="GET";
 if(m[2]==="issue")return !m[3]&&method==="POST";
 return m[3]?method==="PATCH"||method==="DELETE":method==="POST";
}
