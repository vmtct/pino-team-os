import { createRoot } from "react-dom/client";
import { TddActionHost } from "../../app/components/workspace-renderer/Renderer";
import type { ModuleSchema, AuthorizationContext, TddActionBindings, TddActionResult } from "../../lib/workspace-schema";

declare global {
  interface Window { __actionCount?: number; __releaseAction?: () => void; }
}
const mode = new URL(location.href).searchParams.get("mode") ?? "verified";
window.__actionCount = 0;
const schema = {
  surface: "HO", capabilities: { read: "fixture.read", create: "fixture.create" },
  actions: [
    { id: "read", label: "Xem", slot: "table.header", variant: "secondary", capability: "read", handler: "read" },
    { id: "hidden", label: "Ẩn", slot: "table.header", variant: "secondary", capability: "read", handler: "hidden" },
    { id: "disabled", label: "Tạm khóa", slot: "table.header", variant: "secondary", capability: "read", handler: "disabled" },
    { id: "save", label: "Lưu", slot: "table.header", variant: "primary", capability: "create", handler: "save" },
  ],
} as unknown as ModuleSchema;
const context: AuthorizationContext = {
  surface: "HO", authorize: key => mode !== "denied" || key !== "fixture.create",
};
const bindings: TddActionBindings = {
  read: { kind: "navigation", run: () => undefined },
  hidden: { visible: false, run: () => undefined },
  disabled: { disabled: true, run: () => undefined },
  save: { kind: "mutation", run: async () => {
    window.__actionCount = (window.__actionCount ?? 0) + 1;
    if (mode === "slow") await new Promise<void>(resolve => { window.__releaseAction = resolve; });
    if (mode === "network") throw Error("private upstream secret");
    const state = ["verified", "denied-result", "conflict", "invalid", "unverified", "slow"]
      .includes(mode) ? mode === "denied-result" ? "denied" : mode === "slow" ? "verified" : mode : "unverified";
    return { state } as TddActionResult;
  } },
};
createRoot(document.getElementById("root")!).render(
  <TddActionHost schema={schema} context={context} slot="table.header" bindings={bindings} />,
);
