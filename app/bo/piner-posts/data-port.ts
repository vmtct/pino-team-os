/** PAP-2228 / PAP-1746 PNR-APP-HUB: Person-first, transport-neutral Post seam. */
import type {BoRecord} from "@/lib/bo-registration";
import type {ModuleRow} from "@/lib/workspace-schema";
import type {PostFields} from "./schema";
export type PostProgramKey="AFTERSCHOOL"|"MYTIME";
export type PostShellRow=BoRecord & ModuleRow<PostFields>;
export type PostShellContent={media:readonly {id:string;name:string;source:string}[];comments:readonly {id:string;author:string;text:string;source:string}[]};
export type PersonChoice={id:string;label:string};
export type PostSnapshot={rows:readonly PostShellRow[];people:readonly PersonChoice[]};
export interface PostsDataPort {
 readonly centerId:string;
 load(signal:AbortSignal):Promise<PostSnapshot>;
 createDraft(input:{personId:string;programKey:PostProgramKey;caption:string},signal:AbortSignal):Promise<PostShellRow>;
 readContent(postId:string,signal:AbortSignal):Promise<PostShellContent>;
}
export function resolvePerson(choices:readonly PersonChoice[],label:string):PersonChoice|undefined{
 const matches=choices.filter(c=>c.label===label);
 return matches.length===1?matches[0]:undefined;
}
