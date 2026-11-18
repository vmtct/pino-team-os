/** PAP-2126 / PAP-1746 PNR-APP-HUB: FE-owned, transport-neutral seam.
 * Not a frozen Core API or authorization contract. No production adapter yet. */
import type {BoRecord} from "@/lib/bo-registration";
import type {ModuleRow} from "@/lib/workspace-schema";
import type {PostFields} from "./schema";
export type PostShellRow=BoRecord & ModuleRow<PostFields>;
export type PostShellContent={media:readonly {id:string;name:string;source:string}[];comments:readonly {id:string;author:string;text:string;source:string}[]};
export type StudentChoice={id:string;label:string};
export type PostSnapshot={rows:readonly PostShellRow[];students:readonly StudentChoice[]};
export interface PostsDataPort {
 readonly centerId:string;
 load(signal:AbortSignal):Promise<PostSnapshot>;
 createDraft(input:{studentId:string;caption:string},signal:AbortSignal):Promise<PostShellRow>;
 readContent(postId:string,signal:AbortSignal):Promise<PostShellContent>;
}
export function resolveStudent(choices:readonly StudentChoice[], label:string):StudentChoice|undefined {
 const matches=choices.filter(c=>c.label===label);
 return matches.length===1?matches[0]:undefined;
}
