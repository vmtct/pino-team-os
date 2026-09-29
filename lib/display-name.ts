export function shortDisplayName(displayLabel: string | null | undefined): string {
  const words = (displayLabel ?? "").trim().split(/\s+/u).filter(Boolean);
  const token = words.at(-1);
  if (!token) return "";
  const lower = token.toLocaleLowerCase("vi-VN");
  const [first = "", ...rest] = Array.from(lower);
  return `${first.toLocaleUpperCase("vi-VN")}${rest.join("")}`;
}
