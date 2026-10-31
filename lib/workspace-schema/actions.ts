import { allows } from "./validate";
import type { AuthorizationContext, ModuleSchema, TddActionDescriptor } from "./schema";

export type TddActionHandler = Readonly<{
  run: () => void | Promise<void>;
  disabled?: boolean;
}>;
export type TddActionBindings = Readonly<Record<string, TddActionHandler | undefined>>;
/** Server/client safe: check permission from an authenticated context and an actual handler. */
export function authorizedHostActions(
  schema: ModuleSchema, context: AuthorizationContext,
  slot: TddActionDescriptor["slot"], bindings: TddActionBindings,
): readonly TddActionDescriptor[] {
  const eligible = (schema.actions ?? []).filter(action => action.slot === slot &&
    allows(schema, context, action.capability) && Boolean(bindings[action.handler]));
  return [...eligible.filter(action => action.variant !== "primary"),
    ...eligible.filter(action => action.variant === "primary")];
}
