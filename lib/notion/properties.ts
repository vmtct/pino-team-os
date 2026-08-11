export function textProp(page:any,name:string):string {const p=page.properties?.[name];if(!p)return "";if(p.type==="title")return p.title?.map((x:any)=>x.plain_text).join("")??"";if(p.type==="rich_text")return p.rich_text?.map((x:any)=>x.plain_text).join("")??"";if(p.type==="email")return p.email??"";if(p.type==="phone_number")return p.phone_number??"";return "";}
export function selectProp(page:any,name:string):string{return page.properties?.[name]?.select?.name??"";}
export function multiSelectProp(page:any,name:string):string[]{return page.properties?.[name]?.multi_select?.map((x:any)=>x.name)??[];}
export function relationIds(page:any,name:string):string[]{return page.properties?.[name]?.relation?.map((x:any)=>x.id)??[];}
