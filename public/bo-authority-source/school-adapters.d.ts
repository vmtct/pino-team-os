import type { BoRecord, BoModule } from "../../lib/bo-registration";
declare const api: {
  modules: Record<string, BoModule>;
  load(key: string, fetcher: typeof fetch, options?: Record<string, string>): Promise<BoRecord[]>;
  scopeLabel(key: string, options?: Record<string, string>): string;
};
export default api;
