// src/dateUtils.js
export type DateLike = string | number | Date;

let cachedUserTimeZone: string | null = null;

export function getUserTimeZone() {
  if (cachedUserTimeZone) return cachedUserTimeZone;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  cachedUserTimeZone = tz || "UTC";
  return cachedUserTimeZone;
}

type DateParts = { type: string; value: string };

function partsToObj(parts: DateParts[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  return o;
}

/** Return {hour, minute, second} in the user’s local time zone. */
function localHMS(d: DateLike = new Date()) {
  const date = new Date(d);
  const parts = partsToObj(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: getUserTimeZone(),
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

/** Minutes since local midnight at instant d. Always 0–1440. */
export function minutesSinceLocalMidnight(d: DateLike = new Date()) {
  const { hour, minute, second } = localHMS(d);
  return hour * 60 + minute + second / 60;
}

/** Exact UTC instant of local midnight for the day containing d. */
export function startOfDayLocal(d: DateLike = new Date()) {
  const date = new Date(d);
  const msSince = minutesSinceLocalMidnight(date) * 60000;
  return new Date(date.getTime() - msSince);
}

/** YYYY-MM-DD for the local calendar day of instant d. */
export function yyyyMmDdLocal(d: DateLike = new Date()) {
  const date = new Date(d);
  const parts = partsToObj(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: getUserTimeZone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Human-readable datetime in the local time zone. */
export function formatLocalDateTime(dateLike: DateLike) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getUserTimeZone(),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateLike));
}

/** Time-only in the local time zone (HH:MM:SS). */
export function formatLocalTime(dateLike: DateLike) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getUserTimeZone(),
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
