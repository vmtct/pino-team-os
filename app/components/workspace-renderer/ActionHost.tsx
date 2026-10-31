"use client";
import { useState } from "react";
import { TosButton } from "@pino/design-system/react";
import { allows, authorizedHostActions, type AuthorizationContext,
  type ModuleSchema, type TddActionDescriptor, type TddActionBindings } from "@/lib/workspace-schema";

/** Shared engine action chrome: one deterministic order, authorization rechecked at invocation. */
export function TddActionHost({ schema, context, slot, bindings }: {
  schema: ModuleSchema; context: AuthorizationContext; slot: TddActionDescriptor["slot"];
  bindings: TddActionBindings;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const actions = authorizedHostActions(schema, context, slot, bindings);
  if (!actions.length) return null;
  return <div className="tdd-action-host" data-tdd-action-slot={slot} role="group"
    aria-label="Thao tác" aria-busy={busy !== null}>
    {actions.map(action => {
      const binding = bindings[action.handler];
      if (!binding) return null;
      const disabled = Boolean(busy || binding.disabled);
      return <TosButton key={action.id} type="button"
        variant={action.variant === "primary" ? "primary" : "secondary"}
        disabled={disabled} onClick={() => {
          if (disabled || !allows(schema, context, action.capability)) return;
          setBusy(action.id); setError("");
          void Promise.resolve().then(() => binding.run())
            .catch(() => setError("Thao tác chưa được xác minh. Kiểm tra trạng thái trước khi thử lại."))
            .finally(() => setBusy(null));
        }}>{action.label}</TosButton>;
    })}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
