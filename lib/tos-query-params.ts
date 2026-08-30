export function tosQueryParamValue(key:string,value:string):unknown{
  if(key!=="limit")return value;
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)&&parsed>=0?parsed:value;
}
