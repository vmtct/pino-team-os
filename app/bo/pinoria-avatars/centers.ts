/** PAP-982: Center candidate discovery uses ONLY existing Core-authorized BO resources.
 * This is not a grant to read the Self Directory. Its own adapter and Core
 * independently reauthorize the selected Center and permission on every read. */
export type DirectoryCenterSource = "centers" | "workforce/planning/bootstrap";
export type DirectoryCenter = { readonly id: string; readonly displayName: string };
export type DirectoryCenterChoices = { readonly centers: readonly DirectoryCenter[]; readonly source: DirectoryCenterSource };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parse(raw: unknown, source: DirectoryCenterSource): DirectoryCenter[] {
  if(!raw || typeof raw!=="object" || !("data" in raw)) throw Error("Phản hồi cơ sở không hợp lệ.");
  const data=raw.data;
  const items=source==="centers"?data:(data && typeof data==="object" && "centers" in data?data.centers:null);
  if(!Array.isArray(items) || items.length>100) throw Error("Danh sách cơ sở không hợp lệ.");
  const result:DirectoryCenter[]=[];
  const seen=new Set<string>();
  for(const item of items) {
    if(!item || typeof item!=="object" || typeof item.id!=="string" || !UUID.test(item.id) ||
      typeof item.displayName!=="string" || !item.displayName.trim() || seen.has(item.id))
      throw Error("Cơ sở không có định danh hợp lệ.");
    seen.add(item.id);
    // Workforce planning returns a server-authorized list; inactive centers
    // are not candidate operating Centers for the Self Directory.
    if(source==="workforce/planning/bootstrap" && item.status!=="active") continue;
    result.push({id:item.id,displayName:item.displayName});
  }
  return result;
}
export async function loadAuthorizedDirectoryCenters(fetcher:typeof fetch,signal:AbortSignal):Promise<DirectoryCenterChoices>{
  const options={method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal} as const;
  let response=await fetcher("/api/bo/centers",options);
  signal.throwIfAborted();
  let source:DirectoryCenterSource="centers";
  if(response.status===403) {
    // Do not fall back after 401, network errors or malformed 200. This source
    // is independently Core-authorized with workforce.plan.view and Center scope.
    source="workforce/planning/bootstrap";
    response=await fetcher("/api/bo/workforce/planning/bootstrap",options);
  }
  signal.throwIfAborted();
  if(!response.ok) {
    if(response.status===401) throw Error("Vui lòng đăng nhập lại.");
    if(response.status===403) throw Error("Không có nguồn cơ sở được cấp quyền.");
    throw Error("Không thể tải danh sách cơ sở.");
  }
  let raw:unknown;
  try{raw=await response.json();}catch{throw Error("Phản hồi cơ sở không hợp lệ.");}
  signal.throwIfAborted();
  return {centers:parse(raw,source),source};
}
