/** PAP-2394 / HO-MISSION-CRUD: optional supplemental Mission metadata. */
export const missionSupplementalUrlMaxLength = 2048;
export function normalizeMissionSupplementalUrl(value: unknown): {ok:true;value:string|null}|{ok:false} {
  if(value===null||value===undefined)return {ok:true,value:null};
  if(typeof value!=="string")return {ok:false};
  const text=value.trim();
  if(!text)return {ok:true,value:null};
  if(text.length>missionSupplementalUrlMaxLength||!/^(https?):\/\//i.test(text)||/[\s\u0000-\u001f\u007f]/u.test(text))return {ok:false};
  try{
    const url=new URL(text);
    if(!["http:","https:"].includes(url.protocol)||!url.hostname||url.username||url.password)return {ok:false};
    return {ok:true,value:text};
  }catch{return {ok:false}}
}
