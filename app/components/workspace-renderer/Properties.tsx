"use client";
import { BoValue } from "../../bo/components/registration/BoValue";
import type { BoField, BoRecord } from "@/lib/bo-registration";

/** Presentation seam receives only the renderer's authorized record projection. */
export type OverviewProperties = {
  readonly fields: readonly BoField[]; readonly record: BoRecord;
  readonly sections: readonly { readonly id: string; readonly label: string; readonly fields: readonly string[] }[];
};

/** Drawer uses property rows, never the viewport-driven Full Detail grid. */
export function PropertySections({ fields, record, sections, variant, canEdit, onEdit, legacyStyles = false }: {
  readonly fields: readonly BoField[]; readonly record: BoRecord;
  readonly sections: readonly { readonly id: string; readonly label: string; readonly fields: readonly string[] }[];
  readonly variant: "drawer" | "detail"; readonly legacyStyles?: boolean;
  readonly canEdit?: (field: BoField) => boolean;
  readonly onEdit?: (field: BoField, anchor: HTMLButtonElement) => void;
}) {
  const visibleSections = sections.filter(section => section.fields.some(key => fields.some(f => f.key === key)));
  if (!visibleSections.length) return <p role="status">Không có thuộc tính được phép xem.</p>;
  return <>{visibleSections.map(section => <section key={section.id} className={variant === "drawer" ? "property-section" : "v24-prop-section"} data-tdd-properties={variant}>
    {variant === "drawer" ? <h3>{section.label}</h3> : <div className="v24-section-heading"><h4>{section.label}</h4><span className="v24-lock" aria-label="Chỉ đọc">⌁</span></div>}
    <div className={variant === "detail" ? "v24-prop-grid" : undefined}>{section.fields.map(key => {
      const field = fields.find(f => f.key === key); if (!field) return null;
      const editable = Boolean(onEdit && canEdit?.(field));
      return variant === "drawer" ? <div className="property-row" key={key}>
        <div className="property-label"><small>{field.icon}</small>{field.label}</div>
        <button type="button" className="property-control" data-prop={key} disabled={!legacyStyles && !editable} aria-disabled={!editable} tabIndex={editable ? 0 : -1} aria-label={(editable ? "Sửa " : "Chỉ đọc ") + field.label} onClick={e => editable && onEdit?.(field, e.currentTarget)}>
          {key === "id" && !record.id ? <span className="empty-val">Chưa tạo</span> : <BoValue field={field} value={record[key]} />}{editable ? <span className="pencil" aria-hidden="true">✎</span> : null}
        </button>
      </div> : <div className="v24-prop-item" key={key}><div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div><div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + field.label}><BoValue field={field} value={record[key]} full /><span className="v24-lock" aria-label="Chỉ đọc">⌁</span></div></div>;
    })}</div>
  </section>)}</>;
}
