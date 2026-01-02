import { startOfDayLocal, yyyyMmDdLocal } from "../../dateUtils";
import type { DayLog, TrendDay, TrendSeries } from "./types";

const TOP_N_DEFAULT = 7;

export function isWeekend(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const x = d.getDay();
  return x === 0 || x === 6;
}

export function aggregateTopN(
  totalsMap: Record<string, number>,
  topN = TOP_N_DEFAULT
): Record<string, number> {
  const entries = Object.entries(totalsMap).filter(
    ([a]) => a !== "Untracked"
  ) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const keep = new Set(entries.slice(0, topN).map(([a]) => a));
  const out: Record<string, number> = {};
  let other = 0;
  for (const [a, m] of entries) {
    if (keep.has(a)) out[a] = (out[a] || 0) + m;
    else other += m;
  }
  if (other > 0) out["Other"] = other;
  return out;
}

export function buildSeries(days: TrendDay[], chosenActivities: string[]) {
  const byActivity: TrendSeries = {};
  const maxMPerActivity: Record<string, number> = {};
  for (const a of chosenActivities) {
    byActivity[a] = [];
    maxMPerActivity[a] = 0;
  }
  for (const d of days) {
    const total = Math.max(1, d.totalMin);
    for (const a of chosenActivities) {
      const m = d.totals[a] || 0;
      const pct = (m / total) * 100;
      byActivity[a].push({ date: d.date, m, pct, weekend: d.weekend });
      if (m > maxMPerActivity[a]) maxMPerActivity[a] = m;
    }
  }
  return { byActivity, maxMPerActivity };
}

export function upsertTodayInHistory(prevHistory: DayLog[], newDayDoc: DayLog) {
  const idx = prevHistory.findIndex((d) => d?.date === newDayDoc.date);
  if (idx === -1) return [...prevHistory, newDayDoc];
  const copy = prevHistory.slice();
  copy[idx] = newDayDoc;
  return copy;
}

export function splitByLocalMidnight(startD: Date, endD: Date) {
  const segs = [] as { start: Date; end: Date }[];
  let a = new Date(startD);
  const end = new Date(endD);

  const mid = (d: Date) => startOfDayLocal(new Date(d));
  const nextMid = (d: Date) => new Date(mid(d).getTime() + 24 * 60 * 60000);

  while (yyyyMmDdLocal(a) !== yyyyMmDdLocal(end)) {
    const cut = nextMid(a);
    segs.push({ start: a, end: cut });
    a = cut;
  }
  segs.push({ start: a, end });
  return segs;
}
