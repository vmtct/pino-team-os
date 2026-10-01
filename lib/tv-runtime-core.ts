export interface TvRuntimeResponse{status:number;body:unknown;requestId:string}
export interface TvRuntimeCoreBinding{
  context(token:string,displayId:string):Promise<TvRuntimeResponse>;
  snapshot(token:string,displayId:string):Promise<TvRuntimeResponse>;
  events(token:string,displayId:string,after:number,limit?:number):Promise<TvRuntimeResponse>;
  claimPresentation(token:string,displayId:string):Promise<TvRuntimeResponse>;
  completePresentation(token:string,displayId:string,presentationId:string):Promise<TvRuntimeResponse>;
}
export const TV_RUNTIME_COOKIE="pino_tv_runtime";
export function tvRuntimeCookie(request:Request):string{
  return request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${TV_RUNTIME_COOKIE}=`))?.slice(TV_RUNTIME_COOKIE.length+1)??"";
}
export function runtimeJson(result:TvRuntimeResponse):Response{
  return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-request-id":result.requestId}});
}
