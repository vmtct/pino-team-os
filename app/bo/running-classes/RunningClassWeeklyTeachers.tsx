"use client";

import { useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoWorkforceWeeklyPlanning } from "@/lib/bo-model";
import { runningClassWeeklyTeachers } from "@/lib/running-class-weekly-teachers";

export function RunningClassWeeklyTeachers({ centerId, runningClassId }: { centerId: string; runningClassId: string }) {
  const [weekId, setWeekId] = useState("");
  const [weeks, setWeeks] = useState<Array<{ id: string; label: string }>>([]);
  const [planning, setPlanning] = useState<BoWorkforceWeeklyPlanning | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function failure(cause: unknown) {
    setError(cause instanceof BoApiError && cause.status === 403 ? "You do not have permission to view workforce planning." : cause instanceof BoApiError && cause.status === 401 ? "Your session has expired. Sign in again." : "Unable to load workforce planning. Retry.");
  }

  async function loadWeeks() {
    setLoading(true); setError(null);
    try {
      const bootstrap = await boApi.workforcePlanningBootstrap();
      const termIds = new Set(bootstrap.terms.filter(term => term.centerId === centerId).map(term => term.id));
      const options = bootstrap.termWeeks.filter(week => termIds.has(week.termId)).sort((a, b) => b.startDate.localeCompare(a.startDate)).map(week => ({ id: week.id, label: `${week.code} (${week.startDate}–${week.endDate})` }));
      setWeeks(options); setLoaded(true);
    } catch (cause) { failure(cause); }
    finally { setLoading(false); }
  }

  async function loadPlanning(id: string) {
    setWeekId(id); setPlanning(null); setError(null);
    if (!id) return;
    setLoading(true);
    try { setPlanning(await boApi.workforcePlanning(centerId, id)); }
    catch (cause) { failure(cause); }
    finally { setLoading(false); }
  }

  const responsibilities = planning ? runningClassWeeklyTeachers(planning, runningClassId) : [];

  return <section aria-label="Weekly teaching assignments">
    <h3>Weekly teaching assignments</h3>
    {!loaded ? <button type="button" onClick={() => void loadWeeks()} disabled={loading}>{loading ? "Loading…" : "Choose a week to view teachers"}</button> : <label>Term week <select value={weekId} onChange={event => void loadPlanning(event.target.value)} disabled={loading}><option value="">Select week</option>{weeks.map(week => <option key={week.id} value={week.id}>{week.label}</option>)}</select></label>}
    {loaded && !weeks.length ? <p>No term weeks for this center.</p> : null}
    {loading ? <p role="status">Loading workforce planning…</p> : null}
    {error ? <div><p role="alert">{error}</p>{weekId ? <button type="button" disabled={loading} onClick={() => void loadPlanning(weekId)}>Retry selected week</button> : null}</div> : null}
    {planning ? responsibilities.length ? <ul>{responsibilities.map(item => <li key={item.id}>{item.date} · {item.role === "TEACHER" ? "Teacher" : "Teaching assistant"} · {item.name}</li>)}</ul> : <p>No active teaching assignments for this class in the selected week.</p> : null}
  </section>;
}
