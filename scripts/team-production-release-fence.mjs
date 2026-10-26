#!/usr/bin/env node
import { pathToFileURL } from "node:url";
export function decideProductionRollback(input = {}) {
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const oldDeploymentId=text(input.oldDeploymentId), oldVersion=text(input.oldVersion), candidateDeploymentId=text(input.candidateDeploymentId), candidateVersion=text(input.candidateVersion), candidateMarker=text(input.candidateMarker), currentDeploymentId=text(input.currentDeploymentId), currentVersion=text(input.currentVersion), currentMarker=text(input.currentMarker), previousDeploymentId=text(input.previousDeploymentId);
  if (![oldDeploymentId,oldVersion,candidateVersion,candidateMarker,currentDeploymentId,currentVersion].every(Boolean)) return "REFUSE";
  if (currentVersion===candidateVersion) {
    if (candidateDeploymentId) return currentDeploymentId===candidateDeploymentId ? "RESTORE" : "REFUSE";
    return currentDeploymentId!==oldDeploymentId && previousDeploymentId===oldDeploymentId && currentMarker===candidateMarker ? "RESTORE" : "REFUSE";
  }
  if (currentVersion===oldVersion) return currentDeploymentId===oldDeploymentId ? "NOOP" : "REFUSE";
  return "REFUSE";
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { let input; try { input=JSON.parse(process.argv[2] ?? "{}"); } catch { process.exitCode=2; } if (input) process.stdout.write(`${decideProductionRollback(input)}\n`); }
