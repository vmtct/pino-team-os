export function tosQueryParamValue(key:string,value:string,path?:string):unknown{
  if(path==="pinoria/tv-policies/house-ambient/events"&&key==="after"){
    const cursor=Number(value);
    return /^[0-9]+$/.test(value)&&Number.isSafeInteger(cursor)?cursor:value;
  }
  if(key!=="limit")return value;
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)&&parsed>=0?parsed:value;
}
