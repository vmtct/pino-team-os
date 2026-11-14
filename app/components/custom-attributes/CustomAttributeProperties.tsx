"use client";
/** PAP-1670 / PLT-ATTR. No network or permission inference.
 * Future consumer must own authorized projection, editor selection and CAS writes. */
import { PropertySections } from "../workspace-renderer/Properties";
import { projectAttributeRows, type AttributeFieldProjection } from "@/lib/custom-attribute-projection";
import type { BoField } from "@/lib/bo-registration";

export function CustomAttributeProperties({ items,variant,onEdit }:{
 items:readonly AttributeFieldProjection[];
 variant:"drawer"|"detail";
 onEdit?:(field:BoField,anchor:HTMLButtonElement)=>void;
}){
 const p=projectAttributeRows(items);
 if(!p.fields.length)return <p role="status">Chưa có thuộc tính đang hoạt động.</p>;
 return <>{p.invalid.length>0?<p role="alert">Một số giá trị thuộc tính không hợp lệ.</p>:null}
  <PropertySections fields={p.fields} record={p.record} variant={variant}
   sections={[{id:"attributes",label:"Thuộc tính bổ sung",fields:p.fields.map(f=>f.key)}]}
   canEdit={field=>p.editable.has(field.key)} onEdit={onEdit}/></>;
}
