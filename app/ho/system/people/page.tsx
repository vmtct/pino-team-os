import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {HoPersonRuntime} from "./HoPersonRuntime";
/** PAP-2180: read-only native HO Person, admitted Founder and dedicated permission. */
export default async function Page(){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const context=await authorizeHoShell(new Headers(await headers()),env);
 return <HoWorkspace module="people" content={context.permissionKeys.includes("identity.person.ho_view")?<HoPersonRuntime/>:<p role="alert">Bạn không có quyền xem Person.</p>}/>;
}