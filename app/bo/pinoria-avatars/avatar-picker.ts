/** PAP-1710 / Epic PAP-1705 PNR-AVATAR-CRUD. Pure Person option contract. */
export type AvatarCandidate={
 personId:string; pinoriaSelfId?:string|null; displayName:string;
 avatarStatus:string; subjectStatus:string; subjectTypes:string[];
};
export const canonicalPersonId=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isEligibleAvatarCandidate(raw:unknown):raw is AvatarCandidate{
 if(!raw||typeof raw!=="object")return false;
 const p=raw as Partial<AvatarCandidate>;
 return typeof p.personId==="string"&&canonicalPersonId.test(p.personId)
  &&typeof p.displayName==="string"&&p.displayName.trim().length>0
  &&Array.isArray(p.subjectTypes)&&p.subjectTypes.every(v=>typeof v==="string")
  &&typeof p.avatarStatus==="string"&&["ACTIVE","MIXED"].includes(p.subjectStatus??"");
}
export function candidateHasAvatar(person:AvatarCandidate):boolean{
 return !!person.pinoriaSelfId||person.avatarStatus!=="SELF_MISSING";
}
export function matchingAvatarCandidates(candidates:readonly AvatarCandidate[],text:string):AvatarCandidate[]{
 const needle=text.trim().toLocaleLowerCase("vi");
 if(!needle)return [...candidates];
 return candidates.filter(p=>(p.displayName+" "+p.subjectTypes.join(" / ")).toLocaleLowerCase("vi").includes(needle));
}
