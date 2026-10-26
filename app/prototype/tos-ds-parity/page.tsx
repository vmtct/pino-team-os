import {notFound} from "next/navigation";
import TosDsParityClient from "./TosDsParityClient";

/** PAP-1014 — only localhost dev fixture; NEVER allow it in a deployed build. */
export default function TosDsParityPreview(){
 if(process.env.NODE_ENV!=="development"||process.env.PAP1014_DS_LOCAL_PREVIEW!=="true")notFound();
 return <TosDsParityClient/>;
}
