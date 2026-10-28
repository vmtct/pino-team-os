import type { AuthorizationContext, FieldSchema, HistoryBinding, HistoryResult, HistorySubject, ModuleRow, ModuleSchema, MutationAdapter, TableQuery, TddRegistry } from "../workspace-schema";
import type { SavedTddView, ViewTransport } from "@/app/components/workspace-renderer/Table";

export type SurfaceScope = { readonly surface: "BO"; readonly centerId: string } | { readonly surface: "HO" };
export type ProviderRecord<F extends readonly FieldSchema[]> = { readonly row: ModuleRow<F>; readonly centerId?: string; readonly version?: string };
/** Providers call existing authenticated facades using the supplied transport.
 * They own domain projection/query translation, never session or scope grants. */
export type SurfaceProvider<F extends readonly FieldSchema[]> = {
  readonly pagination: "server" | "local-ui";
  readonly list: (query: TableQuery<F>, scope: SurfaceScope, fetcher: typeof fetch, signal: AbortSignal) => Promise<{ readonly records: readonly ProviderRecord<F>[]; readonly total: number }>;
  readonly detail: (id: string, scope: SurfaceScope, fetcher: typeof fetch, signal: AbortSignal) => Promise<ProviderRecord<F> | null>;
  readonly mutation?: (fetcher: typeof fetch, scope: SurfaceScope) => MutationAdapter<F>;
  /** BO writes must identify the Center in the authoritative saved projection. */
  readonly mutationCenter?: (row: ModuleRow<F>) => string;
  readonly history?: { readonly subjectType: string; readonly bind: (fetcher: typeof fetch, scope: SurfaceScope) => HistoryBinding };
};
export type SurfaceDefinition<F extends readonly FieldSchema[]> = Omit<ModuleSchema<F>, "data">;
export type SurfaceOptions<F extends readonly FieldSchema[]> = {
  readonly registry: TddRegistry; readonly definition: SurfaceDefinition<F>; readonly provider: SurfaceProvider<F>;
  /** Actual browser origin. Injectable only to run deterministic transport tests. */
  readonly origin?: string; readonly fetcher?: typeof fetch;
};
export type AdapterViews<F extends readonly FieldSchema[]> = {
  readonly transport?: ViewTransport<F>;
  readonly unavailable: readonly { readonly id: string; readonly name: string }[];
};
export type AuthenticatedSurfaceAdapter<F extends readonly FieldSchema[]> = {
  readonly registry: TddRegistry; readonly schema: ModuleSchema<F>; readonly context: AuthorizationContext;
  readonly scope: SurfaceScope; readonly userId: string;
  readonly capabilities: { readonly read: boolean; readonly edit: boolean; readonly create: false; readonly delete: false; readonly reveal: false; readonly audit: boolean };
  readonly list: (query: TableQuery<F>, signal: AbortSignal) => Promise<{ readonly rows: readonly ModuleRow<F>[]; readonly total: number; readonly versions: Readonly<Record<string, string>> }>;
  readonly detail: (id: string, signal: AbortSignal) => Promise<ProviderRecord<F> | null>;
  readonly mutation?: MutationAdapter<F>;
  readonly views: (signal: AbortSignal) => Promise<AdapterViews<F>>;
  readonly subject: (id: string) => HistorySubject;
  readonly history: (subject: HistorySubject, signal: AbortSignal, cursor?: string | null) => Promise<HistoryResult>;
  readonly dispose: () => void;
};
export type TypedSavedView<F extends readonly FieldSchema[]> = SavedTddView<F>;
