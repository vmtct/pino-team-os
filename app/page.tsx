import TosHome from "./TosHome";
import {TosCameraStageEntry} from "./components/tos-vnext/TosCameraStageEntry";

export const dynamic = "force-dynamic";

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;
  if("cameraReview" in query)return <TosCameraStageEntry query={query}/>;
  return <TosHome />;
}
