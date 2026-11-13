/** PAP-1646 / Epic PAP-650 PNR-TV — independent defense-in-depth Core shape gate.
 * This function does NOT authenticate, authorize a Center, grant viewer rights,
 * fetch a Policy, mount a route or prove a published Policy. It can ONLY be used
 * after the trusted server authenticated the actor and Core authorized the read.
 * F3 D1/grants/G4 remain deferred under PAP-9/PAP-1921.
 */
import { isStableTvPolicyRef } from "./pinoria-tv-viewer-link";

const CENTER_UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EVENT_KINDS = [
  "ARRIVAL", "QUICK_CHOICE", "DEPARTURE", "WISH_REVEAL",
  "EGG_HATCH", "COMPANION_RITUAL", "ONBOARDING_CEREMONY",
] as const;
const CONTEXT_FIELDS = ["name", "path", "room", "companion", "pls", "fruit", "highlight"] as const;

export type ViewerPublishedEventKind = typeof EVENT_KINDS[number];
export type ViewerPublishedContextField = typeof CONTEXT_FIELDS[number];
export type ViewerPublishedRule = Readonly<{
  enabled: boolean;
  priority: number;
  maxAgeSeconds: number;
  suppressInQuietMode: boolean;
}>;
export type ViewerPublishedConfiguration = Readonly<{
  schemaVersion: 1;
  quietMode: boolean;
  events: Readonly<Record<ViewerPublishedEventKind, ViewerPublishedRule>>;
  visibleContext: Readonly<Record<ViewerPublishedContextField, boolean>>;
}>;
export type ViewerPublishedProjection = Readonly<{
  policyRef: string;
  selectedCenterId: string;
  type: "Ambient Welcome";
  aspectRatio: "16:9";
  scope: "DEFAULT" | "CENTER";
  effectiveScope: "DEFAULT" | "CENTER";
  inherited: boolean;
  appliedRevision: number;
  configuration: ViewerPublishedConfiguration;
}>;
export type ViewerTrustedRequestContext = Readonly<{
  policyRef: string;
  centerId: string;
  surface: "HO" | "TOS";
}>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}
function safeInt(value: unknown, lo: number, hi: number): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= lo && value <= hi;
}
function parseConfiguration(value: unknown): ViewerPublishedConfiguration | null {
  if (!record(value) ||
    !hasExactKeys(value, ["schemaVersion", "quietMode", "events", "visibleContext"]) ||
    value.schemaVersion !== 1 || typeof value.quietMode !== "boolean" ||
    !record(value.events) || !hasExactKeys(value.events, EVENT_KINDS) ||
    !record(value.visibleContext) || !hasExactKeys(value.visibleContext, CONTEXT_FIELDS)) return null;

  const events = {} as Record<ViewerPublishedEventKind, ViewerPublishedRule>;
  for (const kind of EVENT_KINDS) {
    const rule = value.events[kind];
    if (!record(rule) ||
      !hasExactKeys(rule, ["enabled", "priority", "maxAgeSeconds", "suppressInQuietMode"]) ||
      typeof rule.enabled !== "boolean" || !safeInt(rule.priority, 0, 100) ||
      !safeInt(rule.maxAgeSeconds, 1, 86400) ||
      typeof rule.suppressInQuietMode !== "boolean") return null;
    events[kind] = {
      enabled: rule.enabled,
      priority: rule.priority,
      maxAgeSeconds: rule.maxAgeSeconds,
      suppressInQuietMode: rule.suppressInQuietMode,
    };
  }

  const visibleContext = {} as Record<ViewerPublishedContextField, boolean>;
  for (const field of CONTEXT_FIELDS) {
    const visible = value.visibleContext[field];
    if (typeof visible !== "boolean") return null;
    visibleContext[field] = visible;
  }
  return { schemaVersion: 1, quietMode: value.quietMode, events, visibleContext };
}

/** Accept only a strict allowlisted *already server-authorized* Core projection.
 * Parsing valid data is never independent authorization or evidence of G4.
 * Any unknown metadata/draft/version/Device/PII fields fail closed.
 */
export function parsePublishedTvPolicyProjection(
  responseBody: unknown,
  trustedContext: ViewerTrustedRequestContext,
): ViewerPublishedProjection | null {
  if (!record(trustedContext) ||
    !isStableTvPolicyRef(trustedContext.policyRef) ||
    !CENTER_UUID_V7.test(trustedContext.centerId) ||
    (trustedContext.surface !== "HO" && trustedContext.surface !== "TOS") ||
    (trustedContext.surface === "TOS" && trustedContext.policyRef === "tvp1-default")) return null;

  if (!record(responseBody) || !hasExactKeys(responseBody, ["data"])) return null;
  const row = responseBody.data;
  if (!record(row) ||
    !hasExactKeys(row, ["policyRef", "selectedCenterId", "type", "aspectRatio",
      "scope", "effectiveScope", "inherited", "appliedRevision", "configuration"]) ||
    row.policyRef !== trustedContext.policyRef ||
    row.selectedCenterId !== trustedContext.centerId ||
    row.type !== "Ambient Welcome" || row.aspectRatio !== "16:9" ||
    (row.scope !== "DEFAULT" && row.scope !== "CENTER") ||
    (row.effectiveScope !== "DEFAULT" && row.effectiveScope !== "CENTER") ||
    typeof row.inherited !== "boolean" || !safeInt(row.appliedRevision, 1, 2147483647)) return null;

  const isDefault = trustedContext.policyRef === "tvp1-default";
  if ((isDefault && (row.scope !== "DEFAULT" || row.effectiveScope !== "DEFAULT" || row.inherited)) ||
    (!isDefault && (row.scope !== "CENTER" || row.inherited !== (row.effectiveScope === "DEFAULT")))) return null;
  const configuration = parseConfiguration(row.configuration);
  if (!configuration) return null;

  return {
    policyRef: trustedContext.policyRef,
    selectedCenterId: trustedContext.centerId,
    type: "Ambient Welcome",
    aspectRatio: "16:9",
    scope: row.scope,
    effectiveScope: row.effectiveScope,
    inherited: row.inherited,
    appliedRevision: row.appliedRevision,
    configuration,
  };
}
