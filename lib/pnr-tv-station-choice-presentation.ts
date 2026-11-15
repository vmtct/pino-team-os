// PAP-655 · Quick Choice / PAP-650 · Pinoria TV (PNR-TV).
// Isolated presentation contract candidate. Not a Core authorization or API schema.
export type StationChoiceOffer = Readonly<{
  offerId: string; itemId: string; offerVersion: number; itemRevision: number;
  displayName: string; pricePls: number; imageUrl: string | null;
}>;
export type StationChoiceTurn = Readonly<{
  visitId: string; centerId: string; learnerName: string; balancePls: number;
  offers: readonly StationChoiceOffer[];
}>;
export type StationChoiceRead = Readonly<{
  centerId: string | null; status: "unverified" | "loading" | "ready" | "error";
  turns: readonly StationChoiceTurn[];
}>;
export type StationChoiceAction =
  | Readonly<{kind:"skip";visitId:string;centerId:string}>
  | Readonly<{kind:"purchase";visitId:string;centerId:string;offerId:string;offerVersion:number;itemRevision:number;pricePls:number}>;

// Hides stale projections; never grants permissions. Trusted parent must provide
// a Center-scoped, server-authorized projection. No local fixtures or persistence.
export function visibleStationChoiceTurns(read:StationChoiceRead,selectedCenterId:string|null):readonly StationChoiceTurn[]{
  if(!selectedCenterId||read.status!=="ready"||read.centerId!==selectedCenterId)return [];
  const signatures=new Map<string,string>(),ambiguous=new Set<string>();
  for(const turn of read.turns){
    if(turn.centerId!==selectedCenterId||!turn.visitId)continue;
    const signature=JSON.stringify([turn.learnerName,turn.balancePls,turn.offers.map(offer=>[
      offer.offerId,offer.itemId,offer.offerVersion,offer.itemRevision,offer.displayName,offer.pricePls,offer.imageUrl
    ])]);
    const previous=signatures.get(turn.visitId);
    if(previous!==undefined&&previous!==signature)ambiguous.add(turn.visitId);
    signatures.set(turn.visitId,signature);
  }
  const seen=new Set<string>();
  return read.turns.filter(turn=>{
    if(turn.centerId!==selectedCenterId||!turn.visitId||ambiguous.has(turn.visitId)||seen.has(turn.visitId)
      ||!turn.learnerName.trim()||!Number.isSafeInteger(turn.balancePls)||turn.balancePls<0
      ||turn.offers.length>3)return false;
    const offerIds=new Set<string>(),itemIds=new Set<string>();
    for(const offer of turn.offers){
      if(!offer.offerId||!offer.itemId||!offer.displayName.trim()||offerIds.has(offer.offerId)||itemIds.has(offer.itemId)
        ||!Number.isSafeInteger(offer.offerVersion)||offer.offerVersion<1
        ||!Number.isSafeInteger(offer.itemRevision)||offer.itemRevision<1
        ||!Number.isSafeInteger(offer.pricePls)||offer.pricePls<1)return false;
      offerIds.add(offer.offerId);itemIds.add(offer.itemId);
    }
    seen.add(turn.visitId);return true;
  });
}

export function stationChoiceAction(turn:StationChoiceTurn,offerId:string|null):StationChoiceAction|null{
  if(offerId===null)return {kind:"skip",visitId:turn.visitId,centerId:turn.centerId};
  const offer=turn.offers.find(o=>o.offerId===offerId);
  if(!offer||offer.pricePls>turn.balancePls)return null;
  return {kind:"purchase",visitId:turn.visitId,centerId:turn.centerId,
    offerId:offer.offerId,offerVersion:offer.offerVersion,itemRevision:offer.itemRevision,pricePls:offer.pricePls};
}

/** UI scoping guard only; the Core adapter remains responsible for effective ACL. */
export function canMountStationQuickChoice(tab:string,centerId:string|null,authorizedCenterIds:readonly string[],read:StationChoiceRead|undefined):boolean{
  return tab==="overview" && !!centerId && authorizedCenterIds.includes(centerId)
    && !!read && read.centerId===centerId && read.status!=="unverified";
}
