/** PAP-1239 / PAP-650 CP1 — authenticated TOS Front Desk House commands.
 * Only the canonical Core PinoriaHouseService writes StudentVisit + Self + Presence.
 */
export type ReceptionOpenVisit = { id: string; checkedInAt: string; version: number };
export type ReceptionLearner = {
  studentProfileId: string;
  displayName: string;
  hasCharacter: boolean;
  openVisit: ReceptionOpenVisit | null;
};
export type PickupScope={centerId:string;studentProfileId:string;expectedVisitId:string;expectedVersion:number};
export type PickupProof={relationshipId:string;relationshipVersion:number;parentId:string;personId:string;personVersion:number;identityVerified:true};
export type PickupOption=Omit<PickupProof,"identityVerified">&{displayName:string;relationshipType:"PARENT"|"GUARDIAN"};
const pickupId=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=1;
function validProof(p:unknown):p is PickupProof{
 if(!p||typeof p!=="object")return false;
 const x=p as Record<string,unknown>;
 return Object.keys(x).length===6&&x.identityVerified===true&&[x.relationshipId,x.parentId,x.personId].every(id=>typeof id==="string"&&pickupId.test(id))&&version(x.relationshipVersion)&&version(x.personVersion);
}
export function pickupProof(option:PickupOption):PickupProof{
 const {relationshipId,relationshipVersion,parentId,personId,personVersion}=option;
 return{relationshipId,relationshipVersion,parentId,personId,personVersion,identityVerified:true};
}
export type ReceptionHouseCheckOutInput = {
  centerId: string;
  studentProfileId: string;
  expectedVisitId: string;
  expectedVersion: number;
  checkedOutAt: string;
  reason: string;
  pickupProof:PickupProof;
};
export type ReceptionHouseCheckOut = {
  visit: ReceptionOpenVisit & { studentProfileId: string; centerId: string; checkedOutAt: string };
  character: { id: string } | null;
  handover:{relationshipId:string;identityVerified:true};
};
export type ReceptionHouseCheckIn = {
  visit: ReceptionOpenVisit & { studentProfileId: string; centerId: string };
  character: { id: string } | null;
};
type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };

export class ReceptionHouseError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ReceptionHouseError";
  }
}
async function fromCore<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
  });
  let envelope: Envelope<T> = {};
  try { envelope = await response.json() as Envelope<T>; }
  catch { /* Preserve HTTP status rather than claiming an unsuccessful write succeeded. */ }
  if (!response.ok || envelope.data === undefined) {
    throw new ReceptionHouseError(response.status, envelope.error?.code ?? "UNKNOWN",
      envelope.error?.message ?? "Không xác minh được kết quả từ Core.");
  }
  return envelope.data;
}

export const tosReceptionHouseApi = {
  /** PAP-2138: same authenticated Center boundary as name search, no local history fallback. */
  recent: (centerId: string, signal?: AbortSignal): Promise<ReceptionLearner[]> => {
    if (!centerId) throw new ReceptionHouseError(400, "INVALID_CENTER", "Thiếu cơ sở.");
    return fromCore<ReceptionLearner[]>(`/api/tos-learning/pinoria/learners/recent?centerId=${encodeURIComponent(centerId)}`, { signal });
  },
  search: (centerId: string, query: string, signal?: AbortSignal): Promise<ReceptionLearner[]> => {
    const term = query.trim();
    if (!centerId || term.length < 2 || term.length > 120) {
      throw new ReceptionHouseError(400, "INVALID_SEARCH", "Nhập ít nhất 2 ký tự tên học viên.");
    }
    return fromCore<ReceptionLearner[]>(
      `/api/tos-learning/pinoria/learners/search?centerId=${encodeURIComponent(centerId)}&query=${encodeURIComponent(term)}`,
      { signal },
    );
  },
  // PAP-2431: only Core can establish the valid Parent/Guardian options for this exact Visit.
  pickupOptions: async (scope:PickupScope,signal?:AbortSignal):Promise<PickupOption[]>=>{
    if(![scope.centerId,scope.studentProfileId,scope.expectedVisitId].every(id=>pickupId.test(id))||!version(scope.expectedVersion))throw new ReceptionHouseError(400,"INVALID_SCOPE","Invalid pickup scope.");
    const raw=await fromCore<{centerId:string;studentProfileId:string;visitId:string;visitVersion:number;options:PickupOption[]}>("/api/tos-learning/pinoria/house/pickup-options?"+new URLSearchParams({...scope,expectedVersion:String(scope.expectedVersion)}),{signal});
    if(!raw||raw.centerId!==scope.centerId||raw.studentProfileId!==scope.studentProfileId||raw.visitId!==scope.expectedVisitId||raw.visitVersion!==scope.expectedVersion||!Array.isArray(raw.options)||raw.options.length>100)throw new ReceptionHouseError(502,"UNVERIFIED_PICKUP","Invalid pickup options.");
    const seen=new Set<string>();
    for(const o of raw.options){
      if(!o||typeof o.displayName!=="string"||!o.displayName.trim()||!["PARENT","GUARDIAN"].includes(o.relationshipType)||!validProof(pickupProof(o))||seen.has(o.relationshipId))throw new ReceptionHouseError(502,"UNVERIFIED_PICKUP","Invalid pickup option.");
      seen.add(o.relationshipId);
    }
    return raw.options;
  },
  // Use a distinct command path: an older Core cannot silently ignore new proof fields.
  checkOut: (input: ReceptionHouseCheckOutInput, idempotencyKey: string) => {
    if (!input.centerId || !input.studentProfileId || !input.expectedVisitId?.trim() || !idempotencyKey.trim() ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !input.reason.trim() || !Number.isFinite(Date.parse(input.checkedOutAt))||!validProof(input.pickupProof)) {
      throw new ReceptionHouseError(400, "INVALID_INPUT", "Invalid checkout scope or evidence.");
    }
    return fromCore<ReceptionHouseCheckOut>("/api/tos-learning/pinoria/house/verified-check-out", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    }).then(result => {
      const visit = result?.visit;
      if (!visit || visit.studentProfileId !== input.studentProfileId ||
          visit.centerId !== input.centerId || visit.id !== input.expectedVisitId ||
          !Number.isSafeInteger(visit.version) || visit.version !== input.expectedVersion+1 ||
          visit.checkedOutAt!==input.checkedOutAt||result.handover?.relationshipId!==input.pickupProof.relationshipId||result.handover?.identityVerified!==true) {
        throw new ReceptionHouseError(502, "UNVERIFIED_CHECKOUT", "Checkout result could not be verified.");
      }
      return result;
    });
  },
  checkIn: (input: { centerId: string; studentProfileId: string; checkedInAt: string }, idempotencyKey: string) => {
    if (!input.centerId || !input.studentProfileId || !idempotencyKey) {
      throw new ReceptionHouseError(400, "INVALID_INPUT", "Thiếu thông tin xác nhận học viên.");
    }
    return fromCore<ReceptionHouseCheckIn>("/api/tos-learning/pinoria/house/check-in", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },
};
