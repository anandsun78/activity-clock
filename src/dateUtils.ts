// src/dateUtils.js
export type DateLike = string | number | Date;

export const EDMONTON_TZ = "America/Edmonton";

type DateParts = { type: string; value: string };

function partsToObj(parts: DateParts[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  return o;
}

/** Return {hour, minute, second} for Edmonton at given instant. */
function edmontonHMS(d: DateLike = new Date()) {
  const date = new Date(d);
  const parts = partsToObj(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: EDMONTON_TZ,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date)
  );
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Minutes since Edmonton local midnight at instant d. Always 0–1440. */
export function minutesSinceEdmontonMidnight(d: DateLike = new Date()) {
  const { hour, minute, second } = edmontonHMS(d);
  return hour * 60 + minute + second / 60;
}

/** Exact UTC instant of Edmonton local midnight for the day containing d. */
export function startOfDayEdmonton(d: DateLike = new Date()) {
  const date = new Date(d);
  const msSince = minutesSinceEdmontonMidnight(date) * 60000;
  return new Date(date.getTime() - msSince);
}

/** YYYY-MM-DD for the Edmonton local calendar day of instant d. */
export function yyyyMmDdEdmonton(d: DateLike = new Date()) {
  const date = new Date(d);
  const parts = partsToObj(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: EDMONTON_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Human-readable datetime in Edmonton. */
export function formatEdmonton(dateLike: DateLike) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateLike));
}

/** Time-only in Edmonton (HH:MM:SS). */
export function formatEdmontonTime(dateLike: DateLike) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EDMONTON_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(dateLike));
}

/** Diff in minutes between two instants. */
export function diffMinutes(a: DateLike, b: DateLike) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/** Format minutes as "Hh Mm". */
export function fmtHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}
