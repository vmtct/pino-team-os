import { display, empty, type BoField, type BoValue as Value } from "@/lib/bo-registration";
const currency = (v: Value) => Number(v).toLocaleString("vi-VN") + " ₫";
const date = (v: Value) => { const d = new Date(String(v).slice(0, 10) + "T12:00:00Z"); return Number.isFinite(d.getTime()) ? d.toLocaleDateString("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }) : display(v); };
const palette = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
export function BoPill({ text, color }: { text: string; color?: string }) {
  const hash = [...text].reduce((sum, ch) => ((sum * 31 + ch.charCodeAt(0)) >>> 0), 7);
  return <span className={`datatag ${color ?? "tag-" + palette[hash % palette.length]}`}>{text}</span>;
}
export function BoValue({ field, value, full = false }: { field: BoField; value: Value; full?: boolean }) {
  if (empty(value)) return <span className="empty-val">Trống</span>;
  switch (field.type) {
    case "currency": return currency(value);
    case "formula": return <span className="formula">{currency(value)}</span>;
    case "date": return date(value);
    case "datetime": return date(value) + " · " + String(value).slice(11, 16);
    case "boolean": return <span role="img" aria-label={value ? "Có" : "Không"} className={`check-indicator ${value ? "on" : ""}`}>{value ? "✓" : ""}</span>;
    case "id": return <span className="id-code">{display(value)}</span>;
    case "select": return <BoPill text={display(value)} color={/Đã duyệt/.test(String(value)) ? "green" : /Cần xử lý/.test(String(value)) ? "gold" : /Bản nháp/.test(String(value)) ? "gray" : "blue"} />;
    case "relation": case "person": return <BoPill text={display(value)} color="blue" />;
    case "multiselect": case "multirelation": { const values = Array.isArray(value) ? value : [String(value)]; return <span className={full ? "v25-full-values" : "cell-multi"}>{(full ? values : values.slice(0, 2)).map((v, i) => <BoPill key={i} text={v} />)}{!full && values.length > 2 ? <small>+{values.length - 2}</small> : null}</span>; }
    case "textarea": return full ? <span className="v25-full-note">{display(value)}</span> : display(value).slice(0, 42) + (display(value).length > 42 ? "…" : "");
    case "url": return "↗ " + display(value).replace(/^https?:\/\//, "");
    default: return display(value);
  }
}
