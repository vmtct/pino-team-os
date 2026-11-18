import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {HoWishRuntime} from "@/app/ho/pinoria/wish-policies/HoWishRuntime";
export default async function Page(){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const context=await authorizeHoShell(new Headers(await headers()),env);
 return <HoWorkspace module="wishPolicies" content={context.permissionKeys.includes("pinoria.wish.config.view")?<HoWishRuntime kind="policy" canManage={context.permissionKeys.includes("pinoria.wish.config.manage")}/>:<p role="alert">Bạn không có quyền xem cấu hình Wish.</p>}/>;
}
