"use client";
import { PropertySections, type PropertyField } from "@pino/design-system/react";
import { BoValue } from "@/app/bo/components/registration/BoValue";
import type { OverviewProperties } from "@/app/components/workspace-renderer/Properties";

/** PAP-1170: presentation only; engine supplies the authorized field/record projection. */
export function SelfDirectoryProperties({ fields, record, sections }: OverviewProperties) {
  const properties: PropertyField[] = fields.map(field => ({
    key: field.key, label: field.label, icon: field.icon, type: "text", readOnly: true,
    // Preserve BO formatting, including select badges and full multi-value text.
    format: () => <BoValue field={field} value={record[field.key]} full />,
  }));
  const values = Object.fromEntries(fields.map(field => {
    const value = record[field.key];
    return [field.key, Array.isArray(value) ? null : value];
  }));
  return <PropertySections recordKey={record.id} fields={properties} values={values}
    sections={sections.map(section => ({ ...section, fields: section.fields.filter(key => fields.some(field => field.key === key)) })).filter(section => section.fields.length > 0)} surface="bo" variant="detail" />;
}
