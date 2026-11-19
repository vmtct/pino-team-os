/** PAP-2202 exact legacy URL redirect, no data or authority. */
import {safeBoStagingReturnTo} from "@/lib/bo-staging-return-to";
function legacyGuestRedirect(request:Request){
 const target=safeBoStagingReturnTo("/bo/guests"+new URL(request.url).search);
 return new Response(null,{status:307,headers:{location:target??"/bo/guests","cache-control":"no-store"}});
}
export const GET=legacyGuestRedirect;
export const HEAD=legacyGuestRedirect;
