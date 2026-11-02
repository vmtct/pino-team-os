import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {notFound,redirect,forbidden} from "next/navigation";
import {authorizeTosV4Staging,TosV4GateError,type TosV4GateEnv} from "@/lib/tos-v4-staging-gate";
import {TeamAuthError} from "@/lib/team-auth";
import TosVNextIntegrationClient from "../prototype/tos-vnext-integration/TosVNextIntegrationClient";
export const dynamic="force-dynamic";
/** Founder-approved staging presentation; original prototype route remains hard-off. */
export default async function TosV4StagingPage(){
 try{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:TosV4GateEnv};
  await authorizeTosV4Staging(new Headers(await headers()),env);
 }catch(error){
  if(error instanceof TosV4GateError&&error.status===404)notFound();
  if((error instanceof TeamAuthError||error instanceof TosV4GateError)&&error.status===401)redirect("/staff-login");
  if(error instanceof TosV4GateError&&error.code==="ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED")redirect("/staff-password/change");
  forbidden();
 }
 return <TosVNextIntegrationClient/>;
}
