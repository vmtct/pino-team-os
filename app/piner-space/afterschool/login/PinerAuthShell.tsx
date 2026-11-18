import type { ReactNode } from "react";
import css from "./piner-auth-shell.module.css";
export function PinerAuthShell({children}:{children:ReactNode}) {
 return <div className={css.unifiedBackdrop}><div className={[css.unifiedShell,css.launcherMockShell].join(" ")} data-piner-shared="unified-shell" data-piner-space="house"><main className={css.unifiedContent} data-piner-slot="content">{children}</main></div></div>;
}