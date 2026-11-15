import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { HoStarterSets } from "./HoStarterSets";
/** PAP-1978: use the existing authenticated HO admission and Item permissions. */
export default async function Page(){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const context=await authorizeHoShell(new Headers(await headers()),env);
 const content=context.permissionKeys.includes("pinoria.item.view")?<HoStarterSets canManage={context.permissionKeys.includes("pinoria.item.manage")}/>:<p role="alert">Bạn không có quyền xem Starter Set.</p>;
 return <HoWorkspace module="starterSets" content={content}/>;
}
