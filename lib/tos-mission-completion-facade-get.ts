/**
 * PAP-1488 / PAP-1676 MISSION-ASSIGNMENT.
 * Completion GET is the one Core TOS route with a query-owned scope contract.
 * Other TOS GETs still use the legacy query-to-body BFF adapter.
 */
export function tosMissionCompletionGetRequest(
  method:string,normalizedPath:string,url:URL,
):{path:string;body:Record<string,never>}|null{
  if(method!=="GET"||
    !/^learning\/mission-assignments\/[0-9a-f-]{36}\/completion$/.test(normalizedPath))
    return null;
  // Cache-busting t is a Team facade concern, never a Core ACL/scope field.
  const query=new URLSearchParams(url.search);
  query.delete("t");
  // Preserve duplicates and unsupported keys so Core can deny them.
  // Do not turn a GET query into a JSON body or relax the Core validator.
  return {
    path:"/"+normalizedPath+(query.size?"?"+query.toString():""),
    body:{},
  };
}
