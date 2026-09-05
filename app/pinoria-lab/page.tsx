import{fixturePinoriaExperienceSource}from"../../lib/pinoria-experience-contract";
import{PinoriaLab}from"./pinoria-lab";

export const metadata={title:"Pinoria Experience Lab · PINO",description:"Presentation-only shell for future Pinoria stages."};

export default async function Page(){const result=await fixturePinoriaExperienceSource.load();return <PinoriaLab result={result}/>;}
