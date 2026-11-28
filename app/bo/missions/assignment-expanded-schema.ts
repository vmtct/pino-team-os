/** PAP-2425 / MISSION-ASSIGNMENT. Expanded native TDD contract; not a live provider or ACL grant. */
import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition } from "@/lib/workspace-adapters/contracts";
import { assignmentDefinition, assignmentFields, assignmentQuery } from "./schema";
import { assignmentCategoryOptions, assignmentPresentationScope, type AssignmentPresentation } from "./assignment-subject-presentation";

const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const permission = assignmentDefinition.capabilities.read;
export const expandedAssignmentFields = [
  ...assignmentFields.map(field => field.key === "student" ? { ...field, label: "Đối tượng" } : field.key === "context" ? {...field,readOnly:false as const,capabilities:{...field.capabilities,inlineEdit:true as const}} : field),
  {key:"category",label:"Category",type:"select",icon:"◉",width:172,permission,readOnly:true,options:assignmentCategoryOptions,capabilities:read},
  {key:"subjectKind",label:"Loại đối tượng",type:"select",icon:"◉",width:150,permission,readOnly:true,options:["Student","Staff","MyTime participant"],capabilities:read},
] as const satisfies readonly FieldSchema[];
export type ExpandedAssignmentFields = typeof expandedAssignmentFields;
type F = ExpandedAssignmentFields;
export const expandedAssignmentQuery: TableQuery<F> = {
  ...assignmentQuery,
  order:["name","category","subjectKind",...assignmentQuery.order.filter(key=>key!=="name")],
  visible:["name","category","subjectKind",...assignmentQuery.visible.filter(key=>key!=="name")],
};
const propertyFields = <T extends readonly F[number]["key"][]>(fields:T) =>
  ["category","subjectKind",...fields] as const;

/** Per-record business slots need a Core-backed subject discriminator in M2.
 * M1 uses this derived schema for the single review subject, never the live route. */
export function expandedAssignmentDefinitionFor(subject: AssignmentPresentation):SurfaceDefinition<F> {
  const scope=assignmentPresentationScope(subject);
  return {
    ...assignmentDefinition,
    fields:expandedAssignmentFields,
    actions:[
      ...assignmentDefinition.actions.map(action=>scope.staffTraining&&action.handler==="confirmReopen"?{...action,label:"Xác nhận"}:action),
      ...(scope.staffTraining?[{id:"assignment-open-complete",label:"Xác nhận hoàn tất",slot:"detail.header",variant:"primary",capability:"edit",handler:"openComplete"}] as const:[]),
    ],
    table:{
      ...assignmentDefinition.table,inlineEdit:{enabled:true,fields:["context"]},
      columns:expandedAssignmentFields.filter(f=>f.capabilities.display).map(f=>({field:f.key,visible:expandedAssignmentQuery.visible.includes(f.key)})),
      filters:{...assignmentDefinition.table.filters,fields:["category","subjectKind",...assignmentDefinition.table.filters.fields]},
      search:{...assignmentDefinition.table.search,fields:["category","subjectKind",...assignmentDefinition.table.search.fields]},
      sort:{...assignmentDefinition.table.sort,fields:["category","subjectKind",...assignmentDefinition.table.sort.fields]},
      group:{...assignmentDefinition.table.group,fields:["category","subjectKind",...assignmentDefinition.table.group.fields]},
      views:{...assignmentDefinition.table.views,builtIn:assignmentDefinition.table.views.builtIn.map(view=>({...view,state:{...view.state,order:expandedAssignmentQuery.order,visible:expandedAssignmentQuery.visible}}))},
    },
    drawer:{...assignmentDefinition.drawer,sections:assignmentDefinition.drawer.sections.map(section=>({...section,fields:propertyFields(section.fields)}))},
    detail:{...assignmentDefinition.detail,overview:{sections:assignmentDefinition.detail.overview.sections.map(section=>({...section,fields:propertyFields(section.fields)}))},
      businessTabs:assignmentDefinition.detail.businessTabs.filter(tab=>tab.id==="diary"?scope.showDiary:scope.showResults)},
  };
}
export function registerExpandedAssignment(registry:TddRegistry, subject:AssignmentPresentation, row:ModuleRow<F> | (()=>ModuleRow<F>)) {
  const definition=expandedAssignmentDefinitionFor(subject);const readRow=typeof row==="function"?row:()=>row;
  return registry.register<F>({...definition,data:{
    id:"pap2425-local-review-only",
    list:async(_query,_context,signal)=>{signal.throwIfAborted();return {rows:[readRow()],total:1};},
    detail:async(id,_context,signal)=>{signal.throwIfAborted();const current=readRow();return id===current.id?current:null;},
  }});
}
