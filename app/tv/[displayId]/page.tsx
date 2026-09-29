import { TvRuntimeHost } from "./TvRuntimeHost";
export default async function TvRuntimePage({params}:{params:Promise<{displayId:string}>}){const {displayId}=await params;return <TvRuntimeHost displayId={displayId}/>;}
