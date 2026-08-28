export function findPrototypeDevice(root: HTMLElement | null) {
  if (!root) return null;
  const header = Array.from(root.querySelectorAll<HTMLElement>("header")).find((candidate) =>
    Boolean(candidate.querySelector("[data-v21-pino-logo='true']")),
  );
  return header?.parentElement instanceof HTMLElement ? header.parentElement : null;
}

export function updatePrototypeBadge(root: HTMLElement, label: string) {
  const badge = Array.from(root.querySelectorAll<HTMLElement>("aside div, aside span")).find((node) => {
    const text = node.textContent?.trim() ?? "";
    return text.startsWith("LOCAL PROTOTYPE") || text.startsWith("BẢN THỬ NỘI BỘ");
  });
  if (badge) badge.textContent = label;
}
