"use client";
import { BoValue } from "../../bo/components/registration/BoValue";
import type { BoField, BoRecord } from "@/lib/bo-registration";
import { useRef, type CSSProperties, type ReactNode, type Ref, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

/** Presentation seam receives only the renderer's authorized record projection. */
export type OverviewProperties = {
  readonly fields: readonly BoField[]; readonly record: BoRecord;
  readonly sections: readonly { readonly id: string; readonly label: string; readonly fields: readonly string[] }[];
};

/** PAP-1728: CREATE reuses the View Drawer field/section renderer; the caller
 * can enable only server-contract fields. All existing View callers remain unchanged. */
export type CreateDrawerField = {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly label?: string;
  /** PAP-1738: opt-in complex CREATE input (e.g. searchable Person combobox).
   * The shared renderer still owns the exact View row, label and section DOM.
   * Existing Parent text inputs and normal View/Detail stay unchanged. */
  readonly control?: ReactNode;
};
/** Drawer uses property rows, never the viewport-driven Full Detail grid. */
export function PropertySections({ fields, record, sections, variant, canEdit, onEdit, legacyStyles = false, sectionActions, labelWidth = 160, onLabelWidthChange, createFields }: {
  readonly fields: readonly BoField[]; readonly record: BoRecord;
  readonly sections: readonly { readonly id: string; readonly label: string; readonly fields: readonly string[] }[];
  readonly variant: "drawer" | "detail"; readonly legacyStyles?: boolean;
  readonly sectionActions?: (sectionId: string) => ReactNode;
  readonly createFields?: Readonly<Record<string, CreateDrawerField>>;
  readonly canEdit?: (field: BoField) => boolean;
  readonly onEdit?: (field: BoField, anchor: HTMLButtonElement) => void;
  readonly labelWidth?: number;
  readonly onLabelWidthChange?: (width: number, reset?: boolean) => void;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const bound = (width: number) => Math.min(240, Math.max(90, Math.round(width)));
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onLabelWidthChange || (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches)) return;
    event.preventDefault(); event.stopPropagation();
    drag.current = { pointerId: event.pointerId, x: event.clientX, width: labelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    onLabelWidthChange?.(bound(drag.current.width + event.clientX - drag.current.x));
  };
  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboardResize = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const next = event.key === "ArrowLeft" ? labelWidth - 10
      : event.key === "ArrowRight" ? labelWidth + 10
      : event.key === "Home" ? 90
      : event.key === "End" ? 240 : null;
    if (next === null || !onLabelWidthChange) return;
    event.preventDefault(); event.stopPropagation();
    onLabelWidthChange(bound(next));
  };
  const visibleSections = sections.filter(section => section.fields.some(key => fields.some(f => f.key === key)));
  if (!visibleSections.length) return <p role="status">Không có thuộc tính được phép xem.</p>;
  return <>{visibleSections.map(section => <section key={section.id} className={variant === "drawer" ? "property-section" : "v24-prop-section"} data-tdd-create={createFields ? "" : undefined} data-tdd-properties={variant} data-tdd-detail-resize={variant === "detail" ? "" : undefined}
    style={variant === "detail" ? { "--tdd-detail-label-width": String(labelWidth) + "px" } as CSSProperties : undefined}>
    {variant === "drawer" ? <h3>{section.label}</h3> : <div className="v24-section-heading"><div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><h4>{section.label}</h4>{sectionActions?.(section.id)}</div><span className="v24-lock" aria-label="Chỉ đọc">⌁</span></div>}
    <div className={variant === "detail" ? "v24-prop-grid" : undefined}>{section.fields.map((key, index) => {
      const field = fields.find(f => f.key === key); if (!field) return null;
      const editable = Boolean(onEdit && canEdit?.(field));
      const creator = variant === "drawer" ? createFields?.[key] : undefined;
      return variant === "drawer" ? <div className="property-row" key={key} data-tdd-field={key}>
        {creator ? <label className="property-label" htmlFor={creator.id}><small>{field.icon}</small>{creator.label ?? field.label}</label>
          : <div className="property-label"><small>{field.icon}</small>{field.label}</div>}
        {creator ? (creator.control !== undefined
          ? <div className="property-control" data-prop={key} data-tdd-custom-create-control="">{creator.control}</div>
          : <input type="text" id={creator.id} className="property-control os-create-select" data-prop={key}
              aria-required={creator.required || undefined} required={creator.required} maxLength={creator.maxLength}
              autoComplete={creator.autoComplete} ref={creator.inputRef} value={creator.value} disabled={creator.disabled}
              onChange={e => creator.onChange(e.target.value)} />)
        : <button type="button" className="property-control" data-prop={key} disabled={!legacyStyles && !editable} aria-disabled={!editable} tabIndex={editable ? 0 : -1} aria-label={(editable ? "Sửa " : "Chỉ đọc ") + field.label} onClick={e => editable && onEdit?.(field, e.currentTarget)}>
          {key === "id" && !record.id ? <span className="empty-val">Chưa tạo</span> : <BoValue field={field} value={record[key]} />}{editable ? <span className="pencil" aria-hidden="true">✎</span> : null}
        </button>}
      </div> : <div className="v24-prop-item" key={key}>
        <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}
          {index === 0 && section === visibleSections[0] && onLabelWidthChange ? <div
            className="tdd-label-resize-handle" role="separator" tabIndex={0}
            aria-orientation="vertical" aria-label="Điều chỉnh độ rộng cột nhãn"
            aria-valuemin={90} aria-valuemax={240} aria-valuenow={labelWidth}
            onPointerDown={beginResize} onPointerMove={moveResize}
            onPointerUp={endResize} onPointerCancel={endResize}
            onDoubleClick={event => { event.preventDefault(); onLabelWidthChange(160, true); }}
            onKeyDown={keyboardResize}
          /> : null}
        </div>
        {editable ? <button type="button" className="v24-prop-value" data-prop={key} aria-label={"Sửa " + field.label} onClick={event => onEdit?.(field, event.currentTarget)}>
          <BoValue field={field} value={record[key]} full /><span className="v24-edit-glyph" aria-hidden="true">✎</span>
        </button> : <div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + field.label}>
          <BoValue field={field} value={record[key]} full /><span className="v24-lock" aria-hidden="true">⌁</span>
        </div>}
      </div>;
    })}</div>
  </section>)}</>;
}
