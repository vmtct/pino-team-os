import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {HoWorldActivationM1} from "./HoWorldActivationM1";
/** PAP-2096 S2. Server-admitted Founder and exact action keys. */
export default async function Page(){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const context=await authorizeHoShell(new Headers(await headers()),env);
 return <HoWorkspace module="worlds" content={context.permissionKeys.includes("pinoria.world.view")?<HoWorldActivationM1 canManage={context.permissionKeys.includes("pinoria.world.manage")}/>:<p role="alert">Bạn không có quyền xem World.</p>}/>;
}
