import { PROTOTYPE_KEYS, PROTOTYPE_SECTIONS,type PrototypeModule } from "@/lib/ho-prototype-fixtures";
import { HoPrototypeWorkspace } from "./HoPrototypeWorkspace";
export const dynamic="force-dynamic";
export default async function PrototypePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const search=await searchParams;
 const m=typeof search.module==="string"?search.module:"centers";
 const selectedModule:PrototypeModule=PROTOTYPE_KEYS.includes(m as PrototypeModule)?m as PrototypeModule:"centers";
 const allowed=PROTOTYPE_SECTIONS[selectedModule];
 const s=typeof search.section==="string"?search.section:"";
 const section=allowed?.some(a=>a.value===s)?s:(selectedModule==="wish"?"catalog":"all");
 return <HoPrototypeWorkspace module={selectedModule} section={section}/>;
}
