/** PAP-1014 — one TOS Design System runtime implementation. Never duplicate primitives per app. */
export {SIX_TOS_APPS,appIcon,appIdentity,TosVNextFrame,TosVNextAppHeader,TosVNextContent,
 TosVNextCard,TosVNextHeading,TosVNextButton,TosVNextBottomNav,TosVNextSheet,
 TosVNextField,TosVNextToast,TosVNextStatus,TosVNextIconButton,TosVNextAppTile,tosVNextStyle
} from "./TosDesignSystem";
export {TosVNextFrame as AppFrame,TosVNextAppHeader as AppHeader,TosVNextContent as AppContent,
 TosVNextCard as AppCard,TosVNextHeading as AppSectionHeading,TosVNextButton as AppButton,
 TosVNextBottomNav as AppBottomNav,TosVNextSheet as AppSheet,TosVNextField as AppField,
 TosVNextToast as AppToast,TosVNextStatus as AppStatusBadge,TosVNextIconButton as AppIconButton,
 TosVNextAppTile as AppTile} from "./TosDesignSystem";
export type {TosVNextAppId,TosVNextMode} from "./types";
export type {TosNavItem,TosStatusKind} from "./TosDesignSystem";

export {default as AppPhoneFrame} from "./AppPhoneFrame";
export {createSlotKeys} from "./Primitives";

export {AppNavShell,AppModalRoot,AppNavRail} from "./Primitives";
