import {runtimeJson, type TvRuntimeCoreBinding} from "@/lib/tv-runtime-core";

export async function handleRuntimeObservation(token:string,displayId:string,report:unknown,core:Pick<TvRuntimeCoreBinding,"validateRuntimeObservation">):Promise<Response>{
  const headers={"cache-control":"no-store"};
  if(!token)return Response.json({error:{code:"TV_RUNTIME_SESSION_REQUIRED"}},{status:401,headers});
  if(!report||typeof report!=="object"||Array.isArray(report))return Response.json({error:{code:"INVALID_OBSERVATION"}},{status:400,headers});
  try{return runtimeJson(await core.validateRuntimeObservation(token,displayId,report));}
  catch{return Response.json({error:{code:"TV_RUNTIME_OBSERVATION_UNAVAILABLE"}},{status:503,headers});}
}
