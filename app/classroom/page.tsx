import ClassroomView from "./ClassroomView";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {notFound,redirect,forbidden} from "next/navigation";
import {classroomVNextSeam,type ClassroomSeamEnv} from "@/lib/classroom-vnext-seam";
import {TosV4GateError} from "@/lib/tos-v4-staging-gate";
import {TeamAuthError} from "@/lib/team-auth";
import ClassroomReadOnlySeam from "./ClassroomReadOnlySeam";

export const dynamic="force-dynamic";

type Props = { searchParams: Promise<{ sessionId?: string }> };

export default async function Page({ searchParams }: Props) {
  let scope;
  try {
    const {env}=await getCloudflareContext({async:true}) as unknown as {env:ClassroomSeamEnv};
    scope=await classroomVNextSeam(new Headers(await headers()),env);
  } catch(error) {
    if(error instanceof TosV4GateError&&error.status===404)notFound();
    if((error instanceof TeamAuthError||error instanceof TosV4GateError)&&error.status===401)redirect("/staff-login");
    if(error instanceof TosV4GateError&&error.code==="ACCESS_STAFF_PASSWORD_CHANGE_REQUIRED")redirect("/staff-password/change");
    forbidden();
  }
  if(scope)return <ClassroomReadOnlySeam {...scope}/>;
  const params = await searchParams;
  return <ClassroomView initialSessionId={params.sessionId ?? ""} />;
}
