/** PAP-2431: read only the existing authorized ArrivalDesk projection.
 * Never derive physical checkout from attendance or absence of an open visit.
 */
import type { ArrivalStatus, OpsGuest } from "./tos-ops-v4-view-model";

export type ReceptionDayVisit = {
  id: string; studentProfileId: string; displayName: string;
  checkedInAt: string; checkedOutAt: string | null; version: number;
};
export type ReceptionDaySession = {
  id: string; scheduledStartsLocal: string; scheduledEndsLocal: string;
  pathName: string | null; className: string | null; spaceName: string | null;
  unresolvedRegistrations: readonly unknown[];
};
export type ReceptionDayLearner = {
  studentProfileId: string; displayName: string; sessionIds: string[];
  hasRosterConflict: boolean;
};
export type ReceptionDaySnapshot = {
  centerId: string; localDate: string; timeZone: string;
  window: { startsAt: string; endsAt: string };
  dayVisitsComplete: boolean; dayVisits: ReceptionDayVisit[];
  sessions: ReceptionDaySession[]; learners: ReceptionDayLearner[];
};
export type ReceptionDayEvent = {
  id: string; occurredAt: string; kind: "ARRIVAL" | "DEPARTURE";
  studentProfileId: string; displayName: string;
};
export type ReceptionDayReadModel = {
  guests: OpsGuest[];
  attendance: Record<string, ArrivalStatus>;
  events: ReceptionDayEvent[];
  activeVisits: Record<string, ReceptionDayVisit>;
  unresolvedRegistrations: number;
  timeZone: string;
};
const instant = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0;

export function projectReceptionDay(snapshot: ReceptionDaySnapshot, centerId: string, localDate: string): ReceptionDayReadModel {
  if (!snapshot || snapshot.centerId !== centerId || snapshot.localDate !== localDate ||
      snapshot.dayVisitsComplete !== true || !instant(snapshot.window?.startsAt) ||
      !instant(snapshot.window?.endsAt) || !Array.isArray(snapshot.dayVisits) ||
      !Array.isArray(snapshot.sessions) || !Array.isArray(snapshot.learners)) {
    throw new Error("Reception day scope or complete visit history is unavailable.");
  }
  const start = Date.parse(snapshot.window.startsAt), end = Date.parse(snapshot.window.endsAt);
  if (end <= start || typeof snapshot.timeZone !== "string" || !snapshot.timeZone) throw new Error("Invalid Reception day window.");
  new Intl.DateTimeFormat("en-CA",{timeZone:snapshot.timeZone}).format(start);
  const sessions = new Map<string, ReceptionDaySession>();
  for (const session of snapshot.sessions) {
    if (!validId(session.id) || sessions.has(session.id) || !Array.isArray(session.unresolvedRegistrations)) {
      throw new Error("Invalid Reception session projection.");
    }
    sessions.set(session.id, session);
  }
  const guests = new Map<string, OpsGuest>();
  const attendance: Record<string, ArrivalStatus> = Object.create(null);
  const activeVisits: Record<string, ReceptionDayVisit> = Object.create(null);
  const events: ReceptionDayEvent[] = [];
  for (const learner of snapshot.learners) {
    if (!validId(learner.studentProfileId) || guests.has(learner.studentProfileId) ||
        !validId(learner.displayName) || !Array.isArray(learner.sessionIds) ||
        learner.sessionIds.some(id => !sessions.has(id))) throw new Error("Invalid Reception learner projection.");
    const related = learner.sessionIds.map(id => sessions.get(id)!);
    const labels = (values: Array<string | null | undefined>) => [...new Set(values.filter((x): x is string => Boolean(x?.trim())))].join(" \u00b7 ") || "\u2014";
    guests.set(learner.studentProfileId, {
      id: learner.studentProfileId, name: learner.displayName, initials: learner.displayName.slice(0, 1),
      className: labels(related.map(s => s.className || s.pathName)),
      classTime: labels(related.map(s => s.scheduledStartsLocal + " \u2013 " + s.scheduledEndsLocal)),
      room: labels(related.map(s => s.spaceName)), guardian: "\u2014",
    });
    if (related.length) attendance[learner.studentProfileId] = "EXPECTED";
  }
  const visitIds = new Set<string>();
  for (const visit of snapshot.dayVisits) {
    const checkedIn = Date.parse(visit.checkedInAt);
    const checkedOut = visit.checkedOutAt === null ? null : Date.parse(visit.checkedOutAt);
    if (!validId(visit.id) || visitIds.has(visit.id) || !validId(visit.studentProfileId) ||
        !validId(visit.displayName) || !Number.isFinite(checkedIn) || checkedIn >= end ||
        (checkedOut !== null && (!Number.isFinite(checkedOut) || checkedOut <= checkedIn || checkedOut < start)) ||
        !Number.isSafeInteger(visit.version) || visit.version < 1) throw new Error("Invalid Reception visit evidence.");
    visitIds.add(visit.id);
    const id = visit.studentProfileId;
    if (!guests.has(id)) guests.set(id, {id, name:visit.displayName, initials:visit.displayName.slice(0,1), className:"\u2014", classTime:"\u2014", room:"\u2014", guardian:"\u2014"});
    if (checkedIn >= start) events.push({id:visit.id+":arrival",kind:"ARRIVAL",occurredAt:visit.checkedInAt,studentProfileId:id,displayName:visit.displayName});
    if (checkedOut !== null && checkedOut < end) events.push({id:visit.id+":departure",kind:"DEPARTURE",occurredAt:visit.checkedOutAt!,studentProfileId:id,displayName:visit.displayName});
    if (checkedOut === null || checkedOut >= end) {
      if (activeVisits[id]) throw new Error("Conflicting active Reception visits.");
      activeVisits[id] = visit;
      attendance[id] = "ARRIVED";
    } else if (attendance[id] !== "ARRIVED") attendance[id] = "LEFT";
  }
  // A legacy current-open row that has no evidence in the requested day is not an expected arrival.
  const visible = [...guests.values()].filter(guest => attendance[guest.id] !== undefined);
  events.sort((a,b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  return {guests:visible.sort((a,b)=>a.name.localeCompare(b.name,"vi")),attendance,activeVisits,events,timeZone:snapshot.timeZone,
    unresolvedRegistrations:snapshot.sessions.reduce((n,s)=>n+s.unresolvedRegistrations.length,0)};
}
export async function readReceptionDay(centerId: string, localDate: string, signal?: AbortSignal) {
  if (!validId(centerId) || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid Reception day request.");
  const response = await fetch("/api/tos-learning/arrival-desk?"+new URLSearchParams({centerId,localDate}),{cache:"no-store",signal});
  const body = await response.json() as {data?:ReceptionDaySnapshot;error?:{message?:string}};
  if (!response.ok || !body.data) throw new Error(body.error?.message || "Reception day is unavailable.");
  return projectReceptionDay(body.data,centerId,localDate);
}

/** Activity is only known for valid, actual own Front Desk shift windows. */
export function receptionShiftActivity(day: ReceptionDayReadModel, windows: readonly {startsLocal:string;endsLocal:string}[]) {
  const minute=(value:string)=> {
    const match=/^(?:\d{4}-\d{2}-\d{2}T)?([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
    return match?Number(match[1])*60+Number(match[2]):NaN;
  };
  const ranges=windows.map(w=>({start:minute(w.startsLocal),end:minute(w.endsLocal)}));
  if (!ranges.length || ranges.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<=w.start)) return null;
  const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:day.timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  return day.events.flatMap(event=>{
    const time=fmt.format(new Date(event.occurredAt)),at=minute(time);
    return ranges.some(w=>at>=w.start&&at<w.end)?[{id:event.id,time,text:event.displayName+(event.kind==="ARRIVAL"?" \u0111\u00e3 \u0111\u1ebfn":" \u0111\u00e3 r\u1eddi PINO")}]:[];
  });
}
