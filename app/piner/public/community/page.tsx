// PAP-1803 · Preserve old local permalink but canonical public UI is /piner/public.
import {redirect} from "next/navigation";
export default function LegacyPublicCommunity(){redirect("/piner/public")}
