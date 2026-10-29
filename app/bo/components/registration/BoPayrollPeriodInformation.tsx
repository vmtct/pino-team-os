import type { BoRecord } from "@/lib/bo-registration";
import type { PayPeriod } from "@/lib/bo-payroll-period-api";

/** Keep Payroll metadata in the same compact, read-only DS property grid as the other BO Detail modules. */
export function payrollPeriodInfoFields(record: BoRecord, period: PayPeriod | null) {
  const asText = (value: unknown) => typeof value === "string" && value.trim() ? value : "—";
  const dateLabel = (value: unknown) => {
    const raw = asText(value);
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return matched ? matched[3] + "/" + matched[2] + "/" + matched[1] : raw;
  };
  return [
    { key: "id", glyph: "#", label: "ID", value: record.id },
    { key: "name", glyph: "Aa", label: "Tên kỳ", value: asText(record.name) },
    { key: "startDate", glyph: "▦", label: "Bắt đầu", value: dateLabel(period?.startDate ?? record.startDate) },
    { key: "endDate", glyph: "▦", label: "Kết thúc", value: dateLabel(period?.endDate ?? record.endDate) },
    { key: "status", glyph: "▣", label: "Trạng thái", value: period?.status === "ARCHIVED" ? "Lưu trữ" : "Đang mở" },
    { key: "centerName", glyph: "↗", label: "Center", value: asText(record.centerName) },
  ] as const;
}

/** No amount/PTE list here: separate KPI summary follows, details are in the Quyết Toán tab. */
export function BoPayrollPeriodInformation({fields}: {fields: ReturnType<typeof payrollPeriodInfoFields>}) {
  return <section className="v24-prop-section" aria-label="Thông tin kỳ lương">
    <div className="v24-section-heading"><h4>Thông tin chính</h4></div>
    <div className="v24-prop-grid" data-pay-info-grid>
      {fields.map(({key,glyph,label,value}) =>
        <div className="v24-prop-item" key={key}>
          <div className="v24-prop-key"><span className="v24-field-glyph" aria-hidden="true">{glyph}</span>{label}</div>
          <div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + label}>{value}</div>
        </div>)}
    </div>
  </section>;
}
