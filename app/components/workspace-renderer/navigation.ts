/** Shared tab behavior; URL/state ownership remains with the hosting workspace. */
export function nextTabIndex(key: string, index: number, length: number): number | null {
  if (!length) return null;
  return key === "Home" ? 0 : key === "End" ? length - 1 : key === "ArrowLeft" ? (index + length - 1) % length : key === "ArrowRight" ? (index + 1) % length : null;
}
export function returnToTable(back: () => void, target?: { focus(): void; readonly isConnected: boolean } | null) {
  back();
  if (target?.isConnected) target.focus();
}
