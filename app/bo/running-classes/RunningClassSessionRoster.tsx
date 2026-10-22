"use client";

import { useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { SessionRoster } from "@/lib/tos-learning-api";

export function RunningClassSessionRoster({ sessionId }: { sessionId: string }) {
  const [roster, setRoster] = useState<SessionRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  async function openRoster() {
    if (opened || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await boApi.sessionRoster(sessionId);
      setRoster(result);
      setOpened(true);
    } catch (cause) {
      setError(cause instanceof BoApiError && cause.status === 403
        ? "You do not have permission to view this session roster."
        : cause instanceof BoApiError && cause.status === 401
          ? "Your session has expired. Sign in again."
          : "Unable to load this session roster. Retry.");
    } finally {
      setLoading(false);
    }
  }

  return <div>
    <button type="button" onClick={opened ? () => { setOpened(false); setRoster(null); } : openRoster} disabled={loading} aria-expanded={opened}>
      {loading ? "Loading roster…" : opened ? "Hide session roster" : "View session roster"}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {opened && roster ? <div>
      <p>Session-specific roster · {roster.entries.length} candidates · {roster.resolvedParticipations.length} resolved</p>
      {roster.entries.length ? <ul>{roster.entries.map(entry => <li key={entry.studentProfileId}>{entry.studentDisplayName} · {entry.status}</li>)}</ul> : <p>No roster candidates for this session.</p>}
      {roster.resolvedParticipations.length ? <ul>{roster.resolvedParticipations.map(entry => <li key={entry.participationId}>{entry.studentDisplayName} · {entry.attendanceStatus}</li>)}</ul> : null}
      {roster.unresolvedRegistrations.length ? <p>{roster.unresolvedRegistrations.length} unresolved registrations.</p> : null}
    </div> : null}
  </div>;
}
