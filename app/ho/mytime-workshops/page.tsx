import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {HoWorkshopTdd} from "@/app/components/mytime-workshop/WorkshopRuntime";
/** PAP-2164: only the actual admitted Founder may access the HO Workshop workspace. */
export default async function Page(){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const context=await authorizeHoShell(new Headers(await headers()),env);
 return <HoWorkspace module="mytimeWorkshops" content={context.permissionKeys.includes("learning.mytime_workshop.ho_view")?<HoWorkshopTdd/>:<p role="alert">Bạn không có quyền xem Workshop.</p>}/>;
}