import { display, empty, type BoField, type BoValue as Value } from "@/lib/bo-registration";
const currency = (v: Value) => Number(v).toLocaleString("vi-VN") + " ₫";
const date = (v: Value) => { const d = new Date(String(v).slice(0, 10) + "T12:00:00Z"); return Number.isFinite(d.getTime()) ? d.toLocaleDateString("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }) : display(v); };
// PAP-1737 / SCH-PARENTS-GUARDIANS: typed datetime means an instant; render it in Vietnam local time.
const vnDateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const datetime = (v: Value) => {
  const instant = new Date(String(v));
  if (!Number.isFinite(instant.getTime())) return display(v);
  const parts: Record<string, string> = {};
  for (const part of vnDateTime.formatToParts(instant)) parts[part.type] = part.value;
  return `${parts.day}/${parts.month}/${parts.year} · ${parts.hour}:${parts.minute}`;
};
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
    case "datetime": return datetime(value);
    case "boolean": return <span role="img" aria-label={value ? "Có" : "Không"} className={`check-indicator ${value ? "on" : ""}`}>{value ? "✓" : ""}</span>;
    case "id": return <span className="id-code">{display(value)}</span>;
    case "select": return <BoPill text={display(value)} color={/Đã duyệt/.test(String(value)) ? "green" : /Cần xử lý/.test(String(value)) ? "gold" : /Bản nháp/.test(String(value)) ? "gray" : "blue"} />;
    case "relation": case "person": return <BoPill text={display(value)} color="blue" />;
    case "multiselect": case "multirelation": { const values = Array.isArray(value) ? value : [String(value)]; return <span className={full ? "v25-full-values" : "cell-multi"}>{(full ? values : values.slice(0, 2)).map((v, i) => <BoPill key={i} text={v} />)}{!full && values.length > 2 ? <small>+{values.length - 2}</small> : null}</span>; }
    case "textarea": return full ? <span className="v25-full-note">{display(value)}</span> : display(value).slice(0, 42) + (display(value).length > 42 ? "…" : "");
    case "url": return <span className="value-url">{"↗ " + display(value).replace(/^https?:\/\//, "")}</span>;
    default: return display(value);
  }
}
