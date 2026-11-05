"use client";
import { useEffect, useState } from "react";
import { latestRequest } from "./resource";
export type Resource<T> = { readonly status: "loading" } | { readonly status: "error" } | { readonly status: "ready"; readonly value: T };
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ load: typeof load; retry: number; result: Resource<T> } | null>(null);
  useEffect(() => {
    const request = latestRequest<T>();
    void request.run(load, value => setState({ load, retry, result: { status: "ready", value } }), () => setState({ load, retry, result: { status: "error" } }));
    return () => request.cancel();
  }, [load, retry]);
  return { result: state?.load === load && state.retry === retry ? state.result : { status: "loading" } as Resource<T>, retry: () => setRetry(n => n + 1) };
}
