"use client";
import { BoRegistrationWorkspace, type BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import { boApi } from "@/lib/bo-api";
import { hoCentersModule, mapHoCenters } from "@/lib/ho-centers";
const source: BoWorkspaceSource = { modules: { centers: hoCentersModule }, load: async (_key, fetcher) => mapHoCenters(await boApi.centers((input, init) => fetcher(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }))), scopeLabel: () => "", surface: "ho", readOnly: true };
export function HoCenters() { return <BoRegistrationWorkspace moduleKey="centers" currentUser={{ displayName: null }} source={source} />; }
