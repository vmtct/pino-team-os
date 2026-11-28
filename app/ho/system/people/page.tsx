import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {HoPersonRuntime} from "./HoPersonRuntime";
import {HoPersonSupportFixtureWorkspace} from "./HoPersonSupportFixture";
import {admitPersonSupportFixture} from "./person-support-stage-admission";
/** PAP-2180: read-only native HO Person, admitted Founder and dedicated permission. */
export default async function Page(){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv & {PAP1523_PERSON_SUPPORT_FIXTURE?:string}};
 const incoming=new Headers(await headers());
 const context=await authorizeHoShell(incoming,env);
 if(admitPersonSupportFixture(env.APP_ENV,incoming.get("host")??"",env.PAP1523_PERSON_SUPPORT_FIXTURE,context))return <HoPersonSupportFixtureWorkspace/>;
 return <HoWorkspace module="people" content={context.permissionKeys.includes("identity.person.ho_view")?<HoPersonRuntime/>:<p role="alert">Bạn không có quyền xem Person.</p>}/>;
}