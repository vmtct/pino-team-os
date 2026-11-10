/**
 * PAP-1488 / Epic PAP-1676 MISSION-ASSIGNMENT.
 * Correct only authenticated TOS Completion GET BFF->Core request translation.
 * Core requires query-scope on the URL and an empty GET body; the generic
 * TOS facade deliberately maps query parameters into body for other routes.
 *
 * This pure helper does not grant/perform any writer mutation.
 */
const scopedCompletionGet=/^learning\/mission-assignments\/[0-9a-f-]{36}\/completion$/;

export function tosLearningCoreTarget(
  method:string,normalizedPath:string,url:URL,body:Record<string,unknown>,
):{path:string;body:Record<string,unknown>}{
  const path="/"+normalizedPath;
  if(method!=="GET"||!scopedCompletionGet.test(normalizedPath)){
    return {path,body};
  }
  const query=new URLSearchParams(url.searchParams);
  // The existing TOS facade drops this optional cache-buster for all routes.
  query.delete("t");
  const suffix=query.toString();
  // Retain duplicate and unexpected keys so Core's strict source validator
  // can reject them instead of BFF silently normalizing an ambiguous scope.
  return {path:path+(suffix?"?"+suffix:""),body:{}};
}
