/** Latest-only commits even when an adapter ignores AbortSignal. */
export function latestRequest<T>() {
  let generation = 0; let controller: AbortController | undefined;
  return {
    async run(load: (signal: AbortSignal) => Promise<T>, commit: (value: T) => void, fail: () => void) {
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal, current = ++generation;
      try { const value = await load(signal); if (!signal.aborted && current === generation) commit(value); }
      catch { if (!signal.aborted && current === generation) fail(); }
    },
    cancel() { generation++; controller?.abort(); },
  };
}
