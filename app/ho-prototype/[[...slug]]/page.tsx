import { notFound } from "next/navigation";
import { HoPrototypeWorkspace } from "../ProtoWorkspace";
import type { HoModule } from "@/lib/ho-system";
import type { ProtoKey } from "@/lib/ho-proto-a23";
const routes:Record<string,HoModule|ProtoKey>={
 "centers":"centers",
 "system/users":"users","system/roles":"roles","system/audit":"audits",
 "learning/syllabi":"syllabi","learning/missions":"missions",
 "pinoria/worlds":"worlds","pinoria/wardrobe":"wardrobe",
 "pinoria/wardrobe-sets":"wardrobeSets","pinoria/effects":"effects",
 "pinoria/tv-policy":"tvPolicy","content/website-cms":"cms",
 "pinoria/wish":"wish","pinoria/activities":"activities",
};
export default async function Page({params}:{params:Promise<{slug?:string[]}>}) {
 const {slug}=await params;
 const key=routes[(slug??[]).join("/")];
 if(!key)notFound();
 return <HoPrototypeWorkspace module={key}/>;
}
