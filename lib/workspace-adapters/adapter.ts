import { allows, allowsField, isFieldValue, validateQuery, fieldValueErrors, type AuthorizationContext, type FieldKey, type FieldSchema, type HistorySubject, type ModuleRow, type ModuleSchema, type MutationAdapter } from "../workspace-schema";
import { loadHistory } from "../workspace-schema";
import { adapterError, type SurfaceSession } from "./session";
import type { AuthenticatedSurfaceAdapter, ProviderRecord, SurfaceOptions } from "./contracts";
import { sharedViews } from "./views";
import { BoApiError } from "../bo-api-error";

/** PAP-1247: an independently guarded domain command is not a generic TDD mutation adapter.
 * Only explicitly declared action contracts can opt into Create/Edit controls on HO.
 * The authenticated adapter remains read-only; Core/BFF MUST independently authorize each command.
 */
export function hasActionOnlyCapability<F extends readonly FieldSchema[]>(
  definition: Pick<ModuleSchema<F>, "actions" | "capabilities" | "table" | "fields">,
  provider: Pick<SurfaceProvider<F>, "mutation">,
  capability: "create" | "edit",
): boolean {
  if (!definition.capabilities[capability] || provider.mutation ||
      definition.table.inlineEdit.enabled || definition.table.inlineEdit.fields.length ||
      definition.fields.some(field => field.capabilities.inlineEdit)) return false;
  return Boolean(definition.actions?.some(action => action.capability === capability &&
    typeof action.handler === "string" && action.handler.trim() &&
    (capability === "create"
      ? ["table.header", "drawer.footer"].includes(action.slot)
      : ["detail.header", "drawer.header", "drawer.footer"].includes(action.slot))));
}
/** The same coordinator serves both adapters; scope/session creation stays separate. */
export async function bindSurface<F extends readonly FieldSchema[]>(session: SurfaceSession, options: SurfaceOptions<F>, signal: AbortSignal): Promise<AuthenticatedSurfaceAdapter<F>> {
  const { definition, provider, registry } = options;
  const readTransport: typeof fetch = (input, init) => {
    if ((init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "GET") return Promise.reject(adapterError(403));
    return session.transport(input, init);
  };
  if (definition.surface !== session.scope.surface || definition.table.pagination.mode !== provider.pagination) throw adapterError(403);
  if ((definition.capabilities.edit && !provider.mutation && !hasActionOnlyCapability(definition, provider, "edit")) ||
      (definition.capabilities.create && !hasActionOnlyCapability(definition, provider, "create")) ||
      (provider.mutation && session.scope.surface === "BO" && !provider.mutationCenter) ||
      (session.scope.surface === "HO" && provider.mutation)) throw adapterError(403);
  await session.refresh(signal);
  if (!allows(definition, session.context, "read")) throw adapterError(403);
  let schema: ModuleSchema<F>;
  const requireContext = (context: AuthorizationContext) => { if (context !== session.context) throw adapterError(403); };
  const requireRead = () => { if (!allows(schema, session.context, "read")) throw adapterError(403); };
  async function guarded<T>(action: (signal: AbortSignal) => Promise<T>, requestSignal: AbortSignal, check = requireRead): Promise<T> {
    requestSignal.throwIfAborted(); await session.refresh(requestSignal); check();
    const result = await action(requestSignal);
    requestSignal.throwIfAborted(); await session.refresh(requestSignal); check();
    return result;
  }
  function project(value: ProviderRecord<F>): ProviderRecord<F> {
    const row = value?.row;
    if (!row || typeof row.id !== "string" || !row.id.trim() || (value.version !== undefined && (typeof value.version !== "string" || !value.version.trim()))) throw adapterError(502);
    if (session.scope.surface === "BO" ? value.centerId !== session.scope.centerId : value.centerId !== undefined) throw adapterError(403);
    const result: Record<string, unknown> = { id: row.id };
    for (const field of schema.fields) {
      if (!allowsField(schema, session.context, field.key, "display")) continue;
      const value = row[field.key as FieldKey<F>];
      if (!isFieldValue(field.type, value)) throw adapterError(502);
      result[field.key] = Array.isArray(value) ? [...value] : value;
    }
    if (!allowsField(schema, session.context, schema.table.identity.field, "display")) throw adapterError(403);
    return { row: Object.freeze(result) as ModuleRow<F>, ...(value.version ? { version: value.version } : {}), ...(value.centerId ? { centerId: value.centerId } : {}) };
  }
  async function detail(id: string, requestSignal: AbortSignal) {
    if (!/^[A-Za-z0-9_:-]{1,200}$/.test(id)) throw adapterError(404);
    return guarded(async signal => {
      const result = await provider.detail(id, session.scope, readTransport, signal);
      if (result && result.row.id !== id) throw adapterError(502);
      return result;
    }, requestSignal).then(value => value ? project(value) : null);
  }
  const list: AuthenticatedSurfaceAdapter<F>["list"] = async (query, requestSignal) => {
    const checkQuery = () => { try { validateQuery(schema, query); } catch { throw adapterError(400); } try { validateQuery(schema, query, session.context); } catch { throw adapterError(403); } };
    const result = await guarded(async signal => {
      checkQuery();
      return provider.list(query, session.scope, readTransport, signal);
    }, requestSignal);
    checkQuery();
    if (!result || !Array.isArray(result.records) || !Number.isSafeInteger(result.total) || result.total < 0 || result.total < result.records.length ||
        new Set(result.records.map(v => v.row.id)).size !== result.records.length ||
        (provider.pagination === "server" && result.records.length > query.pageSize) ||
        (provider.pagination === "local-ui" && result.total !== result.records.length)) throw adapterError(502);
    return { rows: result.records.map(value => project(value).row), total: result.total, versions: Object.freeze(Object.fromEntries(result.records.filter(v => v.version).map(v => [v.row.id, v.version!]))) };
  };
  const mutation: MutationAdapter<F> | undefined = provider.mutation ? { update: async (id, patch, version, context, signal) => {
    requireContext(context);
    const check = () => {
      requireRead(); if (!allows(schema, context, "edit")) throw adapterError(403);
      if (typeof version !== "string" || !version.trim() || !patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length) throw adapterError(400);
      for (const [key, value] of Object.entries(patch)) {
        const field = schema.fields.find(f => f.key === key);
        if (key === "id" || !field || !allowsField(schema, context, key, "inlineEdit")) throw adapterError(403);
        if (fieldValueErrors(field, value).length) throw adapterError(400);
      }
    };
    const result = await guarded(async signal => {
      const current = await detail(id, signal);
      if (!current) throw adapterError(404);
      if (!current.version || current.version !== version) return { status: "conflict" as const };
      const result = await provider.mutation!(session.transport, session.scope).update(id, patch, version, context, signal);
      if (result.status === "saved") {
        if (!result.row || result.row.id !== id || typeof result.version !== "string" || !result.version.trim() || result.version === version) throw adapterError(502);
        if (session.scope.surface === "BO" && provider.mutationCenter!(result.row) !== session.scope.centerId) throw adapterError(403);
      }
      return result;
    }, signal, check);
    return result.status === "saved" ? { ...result, row: project({ row: result.row, version: result.version, ...(session.scope.surface === "BO" ? { centerId: session.scope.centerId } : {}) }).row } : result;
  } } : undefined;
  const history = provider.history?.bind(readTransport, session.scope) ?? definition.detail.history;
  if (!provider.history && history.kind === "provider") throw adapterError(403);
  const boundHistory = history.kind === "provider" ? { ...history, load: async (...args: Parameters<typeof history.load>) => {
    const [subject, context, cursor, signal] = args; requireContext(context);
    try {
    const result = await guarded(async () => { if (!await detail(subject.id, signal)) throw adapterError(404); return loadHistory({ ...schema, detail: { ...schema.detail, history } } as unknown as ModuleSchema, subject, context, signal, cursor); }, signal,
      () => { requireRead(); if (!allows(schema, context, "history") || !context.authorize(history.source.permission)) throw adapterError(403); });
    return loadHistory({ ...schema, detail: { ...schema.detail, history: { ...history, load: async () => result } } } as unknown as ModuleSchema, subject, context, signal, cursor);
    } catch (error) { if (error instanceof BoApiError && error.status === 403) return { status: "denied" as const }; throw error; }
  } } : history;
  schema = registry.register({ ...definition, detail: { ...definition.detail, history: boundHistory }, data: {
    id: "authenticated-" + session.scope.surface.toLowerCase(),
    list: async (query, context, signal) => { requireContext(context); return list(query, signal); },
    detail: async (id, context, signal) => { requireContext(context); return (await detail(id, signal))?.row ?? null; },
  } });
  requireRead();
  return Object.freeze({ registry, schema, scope: session.scope, userId: session.principal!.userId, context: session.context, list, detail, mutation,
    get capabilities() { return Object.freeze({ read: allows(schema, session.context, "read"), edit: Boolean(mutation && allows(schema, session.context, "edit")), create: false as const, delete: false as const, reveal: false as const, audit: history.kind === "provider" && allows(schema, session.context, "history") && session.context.authorize(history.source.permission) }); },
    views: (signal: AbortSignal) => sharedViews(schema, session, guarded, signal), subject: (id: string) => ({ type: provider.history?.subjectType ?? schema.key, id }),
    history: (subject: HistorySubject, signal: AbortSignal, cursor: string | null = null) => loadHistory(schema as unknown as ModuleSchema, subject, session.context, signal, cursor), dispose: session.dispose });
}
