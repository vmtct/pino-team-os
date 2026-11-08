"use client";
/* PAP-1604 / PAP-1605 / PAP-1606 · Epic PAP-1601.
 * Navigation locale is intentionally distinct from business-data/TDD values.
 */
import { createContext, useContext } from "react";
import { pinoLocalizedLabel, type PinoLanguage, type PinoSurface } from "./pino-nav-locale";

export type PinoNavLocaleContextValue = Readonly<{
  surface: PinoSurface;
  language: PinoLanguage;
}>;
export const PinoNavLocaleContext = createContext<PinoNavLocaleContextValue | null>(null);
export function LocalizedModuleTitle({ label, moduleKey }: { label: string; moduleKey?: string }) {
  const context = useContext(PinoNavLocaleContext);
  if (!context) return <>{label}</>;
  return <>{pinoLocalizedLabel(context.surface, "Module Title", moduleKey ?? label, label, context.language)}</>;
}
