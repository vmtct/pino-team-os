/** Optional typed policy on existing primitives; absence preserves legacy behavior. */
export type TablePolicy = {
  readonly identity: string; readonly search: readonly string[]; readonly filter: readonly string[];
  readonly sort: readonly string[]; readonly group: readonly string[]; readonly edit: readonly string[];
  readonly viewActions: readonly string[];
};
