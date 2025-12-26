import React, { useEffect, useMemo, useState } from "react";
import "./HabitTracker.css";
import "./ActivityClock.css";
import {
  yyyyMmDdEdmonton,
  formatEdmonton,
  diffMinutes,
  startOfDayEdmonton,
  minutesSinceEdmontonMidnight,
} from "../dateUtils";
import { filterOutVacationLogs, useVacationDays } from "../vacationDays";
import { fmtM } from "./activity/utils";
import {
  ActivityCardMini,
  Bar,
  DonutChart,
  MultiLinePerDay,
} from "./activity/ActivityCharts";
import {
  aggregateTopN,
  buildSeries,
  isWeekend,
  splitByEdmontonMidnight,
  upsertTodayInHistory,
} from "./activity/helpers";
import type { DayLog, LoggedSegments } from "./activity/types";
import SessionsPanel from "./activity/SessionsPanel";
import VacationDaysPanel from "./VacationDaysPanel";
import { Card, CardHeader, Chip } from "./shared/Card";

const START_DATE_ISO = "2025-12-01";
const TOP_N = 7;

/* -------------------- Main -------------------- */
export default function ActivityClock() {
  const [now, setNow] = useState<Date>(new Date());

  // Clamp initial start to Edmonton today if LS was from a prior day
  const [start, setStart] = useState<Date>(() => {
    const ls = localStorage.getItem("activity_clock_last_stop");
    const lsDate = ls ? new Date(ls) : null;
    const todayMid = startOfDayEdmonton(new Date());
    const initial = lsDate
      ? new Date(Math.max(lsDate.getTime(), todayMid.getTime()))
      : todayMid;
    return initial;
  });

  const [nameInput, setNameInput] = useState<string>("");
  const [minutesInput, setMinutesInput] = useState<string>(""); // minutes to log (optional)
  const [names, setNames] = useState<string[]>([]);
  const [todayLog, setTodayLog] = useState<DayLog>({
    date: yyyyMmDdEdmonton(),
    sessions: [],
  });
  const [history, setHistory] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [vacationDays] = useVacationDays();

  const [mergeAdjacent, setMergeAdjacent] = useState<boolean>(true);
  const [showGaps, setShowGaps] = useState<boolean>(true);
  const [activityFilter, setActivityFilter] = useState<string>("All");

  const [trendScope, setTrendScope] = useState<"All" | "Weekdays" | "Weekends">(
    "All"
  );
  const [trendDays, setTrendDays] = useState<number>(30);
  const [mode, setMode] = useState<"m" | "pct">("m"); // minutes | pct
  const [focus, setFocus] = useState<string>("");

  // ✅ For undo: previous start + segments we just logged
  const [lastLogged, setLastLogged] = useState<LoggedSegments>(null);

  const originalTitle =
    typeof document !== "undefined" ? document.title : "activity-clock";

  // Tick clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const today = yyyyMmDdEdmonton();

        // names
        {
          const r = await fetch("/api/activityNames");
          const t = await r.text();
          let data = [];
          try {
            data = t ? JSON.parse(t) : [];
          } catch {}
          setNames(Array.isArray(data) ? data : []);
        }

        // today
        let loadedToday = { date: today, sessions: [] };
        {
          const r = await fetch(`/api/activityLogs?date=${today}`);
          const t = await r.text();
          try {
            const d = t ? JSON.parse(t) : null;
            loadedToday = d && d.date ? d : { date: today, sessions: [] };
          } catch {}
          setTodayLog(loadedToday);
        }

        // anchor start to latest end (today) else clamp LS/midnight to today
        if (loadedToday.sessions?.length > 0) {
          const latestEnd = new Date(
            Math.max(
              ...loadedToday.sessions.map((s) =>
                new Date(String(s.end)).getTime()
              )
            )
          );
          setStart(latestEnd);
          localStorage.setItem(
            "activity_clock_last_stop",
            latestEnd.toISOString()
          );
        } else {
          const ls = localStorage.getItem("activity_clock_last_stop");
          const candidate = ls ? new Date(ls) : startOfDayEdmonton();
          const clamped = new Date(
            Math.max(candidate.getTime(), startOfDayEdmonton().getTime())
          );
          setStart(clamped);
        }

        // history (inclusive from START_DATE_ISO .. today)
        const logs = [];
        const startD = new Date(START_DATE_ISO + "T00:00:00");
        const todayStr = today;
        for (
          let d = new Date(startD);
          yyyyMmDdEdmonton(d) <= todayStr;
          d.setDate(d.getDate() + 1)
        ) {
          const dayKey = yyyyMmDdEdmonton(d);
          const r = await fetch(`/api/activityLogs?date=${dayKey}`);
          const txt = await r.text();
          let data = null;
          try {
            data = txt ? JSON.parse(txt) : null;
          } catch {}
          logs.push(data && data.date ? data : { date: dayKey, sessions: [] });
        }
        setHistory(logs);
      } catch (e) {
        console.error("ActivityClock load error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Today’s breakdown (Edmonton day)
  const todayBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of todayLog.sessions) {
      const m = diffMinutes(s.start, s.end);
      totals[s.activity] = (totals[s.activity] || 0) + m;
    }
    const sinceMidnight = minutesSinceEdmontonMidnight(now);
    const rows = (Object.entries(totals) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        activity: k,
        minutes: v,
        pct: sinceMidnight ? (v / sinceMidnight) * 100 : 0,
      }));

    const totalTracked = Object.values(totals).reduce((a, b) => a + b, 0);
    const untracked = Math.max(0, sinceMidnight - totalTracked);
    if (untracked > 0)
      rows.push({
        activity: "Untracked",
        minutes: untracked,
        pct: sinceMidnight ? (untracked / sinceMidnight) * 100 : 0,
      });

    return { rows, sinceMidnight, totalTracked };
  }, [todayLog, now]);

  const filteredHistory = useMemo(
    () => filterOutVacationLogs(history),
    [history, vacationDays]
  );

  // Historical (per day averages)
  const historical = useMemo(() => {
    const perDayTotals: Record<
      string,
      { totalMinutes: number; daysWithAny: number }
    > = {};
    let dayCount = 0;
    let sumDailyTracked = 0;
    for (const log of filteredHistory) {
      if (!log?.sessions) continue;
      const daily: Record<string, number> = {};
      for (const s of log.sessions)
        daily[s.activity] =
          (daily[s.activity] || 0) + diffMinutes(s.start, s.end);

      const dailyTracked = Object.values(daily).reduce((a, b) => a + b, 0);
      sumDailyTracked += dailyTracked;

      for (const [a, m] of Object.entries(daily)) {
        perDayTotals[a] = perDayTotals[a] || {
          totalMinutes: 0,
          daysWithAny: 0,
        };
        perDayTotals[a].totalMinutes += m;
        perDayTotals[a].daysWithAny += 1;
      }
      dayCount++;
    }
    const avgPerDay = Object.fromEntries(
      Object.entries(perDayTotals).map(([a, v]) => [
        a,
        v.totalMinutes / Math.max(v.daysWithAny, 1),
      ])
    );

    const todayMap = Object.fromEntries(
      todayBreakdown.rows.map((r) => [r.activity, r.minutes])
    );
    const deltas = Object.entries(avgPerDay)
      .map(([a, avgM]) => {
        const todayM = todayMap[a] || 0;
        const delta = todayM - avgM;
        const deltaPct = avgM ? (delta / avgM) * 100 : 0;
        return { activity: a, avgM, todayM, delta, deltaPct };
      })
      .sort((a, b) => b.todayM - a.todayM);

    const avgTrackedPerDay = dayCount > 0 ? sumDailyTracked / dayCount : 0;

    return { avgPerDay, deltas, dayCount, avgTrackedPerDay };
  }, [filteredHistory, todayBreakdown]);

  // Build days + activity list for trends
  const trendData = useMemo(() => {
    const todayKey = yyyyMmDdEdmonton(now);
    const days = filteredHistory.map((log) => {
      const totals: Record<string, number> = {};
      for (const s of log?.sessions || []) {
        const m = diffMinutes(s.start, s.end);
        totals[s.activity] = (totals[s.activity] || 0) + m;
      }

      const tracked = Object.values(totals).reduce((a: number, b) => a + b, 0);
      const denom =
        log.date === todayKey ? minutesSinceEdmontonMidnight(now) : 1440;

      const safeDenom = Math.max(1, Math.round(denom));
      const untracked = Math.max(0, safeDenom - Math.min(tracked, safeDenom));

      if (untracked > 0) {
        totals["Untracked"] = (totals["Untracked"] || 0) + untracked;
      }

      return {
        date: log.date,
        weekend: isWeekend(log.date),
        totals,
        totalMin: safeDenom,
      };
    });

    const activities = Array.from(
      new Set(days.flatMap((d) => Object.keys(d.totals)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return { days, activities };
  }, [filteredHistory, now]);

  // Apply windowing + scope (all/weekdays/weekends)
  const filteredTrendDays = useMemo(() => {
    let ds = trendData.days.slice(-trendDays);
    if (trendScope === "Weekdays") ds = ds.filter((d) => !d.weekend);
    if (trendScope === "Weekends") ds = ds.filter((d) => d.weekend);
    return ds;
  }, [trendData.days, trendScope, trendDays]);

  // Totals in the selected window (for TOP_N selection)
  const windowTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of filteredTrendDays) {
      for (const [a, mm] of Object.entries(d.totals)) {
        if (a === "Untracked") continue;
        m[a] = (m[a] || 0) + mm;
      }
    }
    return m;
  }, [filteredTrendDays]);

  // Chosen activities (top N + Other if needed)
  const chosenActivities = useMemo(() => {
    const agg = aggregateTopN(windowTotals, TOP_N);
    return Object.keys(agg).sort((a, b) => agg[b] - agg[a]);
  }, [windowTotals]);

  // Series for the multi-line chart and minis
  const series = useMemo(() => {
    const mapped = filteredTrendDays.map((d) => {
      const keepSet = new Set(chosenActivities);
      const totals = {};
      let other = 0;
      for (const [a, m] of Object.entries(d.totals)) {
        if (a === "Untracked") continue;
        if (keepSet.has(a)) totals[a] = (totals[a] || 0) + m;
        else other += m;
      }
      if (other > 0 && keepSet.has("Other")) totals["Other"] = other;
      return { date: d.date, weekend: d.weekend, totals, totalMin: d.totalMin };
    });
    return buildSeries(mapped, chosenActivities);
  }, [filteredTrendDays, chosenActivities]);

  // Selected lines state + effect
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const chosenKey = useMemo(
    () => chosenActivities.join("\u0001"),
    [chosenActivities]
  );
  useEffect(() => {
    setSelectedLines((prev: Set<string>) => {
      const next = new Set(
        [...prev].filter((a) => chosenActivities.includes(a))
      );
      if (next.size === 0 && chosenActivities[0]) next.add(chosenActivities[0]);
      return next;
    });
  }, [chosenKey, chosenActivities]);

  // Elapsed minutes since start
  const elapsedMins = useMemo(() => diffMinutes(start, now), [start, now]);

  // Update document title
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `⏱ ${fmtM(elapsedMins)} – activity-clock`;
    return () => {
      document.title = originalTitle;
    };
  }, [elapsedMins, originalTitle]);

  // Persist a new activity name
  async function ensureNamePersisted(name) {
    if (!name || names.includes(name)) return;
    const r = await fetch("/api/activityNames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok)
      setNames((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
  }

  // Log from current "start" for either:
  //   - explicitMinutes (backfilling a chunk), OR
  //   - full elapsed (start -> now) when minutes is empty
  async function logSinceLastStop(activityName, explicitMinutes) {
    const clean = (activityName ?? nameInput).trim();
    if (!clean) return;

    const prevStart = start; // for undo

    const minutes = Number(explicitMinutes);
    const useMinutes = Number.isFinite(minutes) && minutes > 0;

    const todayMid = startOfDayEdmonton();
    const nowD = new Date();

    let sessionStart = new Date(Math.max(start.getTime(), todayMid.getTime()));
    if (sessionStart > nowD) sessionStart = nowD;

    let sessionEnd;
    if (useMinutes) {
      const desiredEnd = new Date(sessionStart.getTime() + minutes * 60 * 1000);
      sessionEnd = desiredEnd.getTime() > nowD.getTime() ? nowD : desiredEnd;
    } else {
      sessionEnd = nowD;
    }

    if (sessionEnd <= sessionStart) return;

    const segments = splitByEdmontonMidnight(sessionStart, sessionEnd);

    // For undo, store the exact values we send to the backend (ISO strings)
    const segmentsForUndo = segments.map((seg) => ({
      start: seg.start.toISOString(),
      end: seg.end.toISOString(),
      activity: clean,
    }));

    let latestTodayDoc = null;

    // Save each segment to backend
    for (const seg of segments) {
      const dateStr = yyyyMmDdEdmonton(seg.start);
      const res = await fetch(`/api/activityLogs?date=${dateStr}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: { start: seg.start, end: seg.end, activity: clean },
        }),
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok || !data) {
        console.error("Failed to save session", res.status, text);
        return;
      }

      setHistory((prev) => upsertTodayInHistory(prev, data));

      if (dateStr === yyyyMmDdEdmonton()) {
        latestTodayDoc = data;
      }
    }

    if (latestTodayDoc) setTodayLog(latestTodayDoc);

    await ensureNamePersisted(clean);

    // Move start forward to the end of what we just logged
    const newStart = sessionEnd;
    setStart(newStart);
    localStorage.setItem("activity_clock_last_stop", newStart.toISOString());

    // Store undo info
    setLastLogged({
      prevStart: prevStart.toISOString(),
      segments: segmentsForUndo,
    });

    setNameInput("");
    setMinutesInput("");
  }

  // ✅ Undo last logged chunk (also in DB)
  async function undoLast() {
    if (!lastLogged || !lastLogged.segments?.length) return;

    const { prevStart, segments } = lastLogged;

    try {
      // 1) Tell backend to remove those sessions
      for (const seg of segments) {
        const dateStr = yyyyMmDdEdmonton(new Date(seg.start));
        await fetch(`/api/activityLogs?date=${dateStr}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: {
              start: seg.start,
              end: seg.end,
              activity: seg.activity,
            },
          }),
        });
      }

      // 2) Reload today's doc from server so frontend matches DB
      const today = yyyyMmDdEdmonton();
      try {
        const r = await fetch(`/api/activityLogs?date=${today}`);
        const t = await r.text();
        let d = null;
        try {
          d = t ? JSON.parse(t) : null;
        } catch {}
        setTodayLog(d && d.date ? d : { date: today, sessions: [] });
      } catch (e) {
        console.error("Failed to reload today after undo", e);
      }

      // 3) Update in-memory history for all affected days
      setHistory((prev) =>
        prev.map((day) => {
          const dateStr = day.date;
          const filteredSessions = (day.sessions || []).filter((sess) => {
            return !segments.some((seg) => {
              const segDate = yyyyMmDdEdmonton(new Date(seg.start));
              return (
                segDate === dateStr &&
                new Date(sess.start).getTime() ===
                  new Date(seg.start).getTime() &&
                new Date(sess.end).getTime() === new Date(seg.end).getTime() &&
                sess.activity === seg.activity
              );
            });
          });
          return { ...day, sessions: filteredSessions };
        })
      );

      // 4) Restore previous start
      if (prevStart) {
        const ps = new Date(prevStart);
        setStart(ps);
        localStorage.setItem("activity_clock_last_stop", ps.toISOString());
      }

      setLastLogged(null);
    } catch (e) {
      console.error("Undo failed", e);
    }
  }

  const sessionsSorted = useMemo(
    () =>
      (todayLog.sessions || [])
        .slice()
        .sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        ),
    [todayLog.sessions]
  );

  const mergedSessions = useMemo(() => {
    if (!mergeAdjacent) return sessionsSorted;
    const out = [];
    const MAX_GAP_MIN = 3;
    for (const s of sessionsSorted) {
      const last = out[out.length - 1];
      if (
        last &&
        last.activity === s.activity &&
        diffMinutes(last.end, s.start) <= MAX_GAP_MIN
      ) {
        last.end = s.end;
      } else {
        out.push({ ...s });
      }
    }
    return out;
  }, [sessionsSorted, mergeAdjacent]);

  const withGaps = useMemo(() => {
    if (!showGaps) return mergedSessions;
    const res = [];
    for (let i = 0; i < mergedSessions.length; i++) {
      const cur = mergedSessions[i];
      res.push(cur);
      const next = mergedSessions[i + 1];
      if (next) {
        const gapMin = diffMinutes(cur.end, next.start);
        if (gapMin >= 5) {
          res.push({
            start: cur.end,
            end: next.start,
            activity: "__GAP__",
            gapMin,
          });
        }
      }
    }
    return res;
  }, [mergedSessions, showGaps]);

  const filteredSessions = useMemo(
    () =>
      activityFilter === "All"
        ? withGaps
        : withGaps.filter(
            (s) => s.activity === activityFilter || s.activity === "__GAP__"
          ),
    [withGaps, activityFilter]
  );

  const totalTodayMins = useMemo(
    () =>
      (sessionsSorted || []).reduce(
        (acc, s) => acc + diffMinutes(s.start, s.end),
        0
      ),
    [sessionsSorted]
  );

  // ---------- Styles ----------
  const activitiesToday = useMemo(
    () =>
      Array.from(
        new Set(
          (todayLog.sessions || [])
            .map((s) => s.activity)
            .filter((a) => a && a !== "__GAP__")
        )
      ).sort((a, b) => a.localeCompare(b)),
    [todayLog.sessions]
  );

  // helper to render delta badge
  const deltaBadge = (todayVal, avgVal, invert = false) => {
    if (!avgVal) return null;
    const pct = ((todayVal - avgVal) / avgVal) * 100;
    const good = invert ? pct < 0 : pct > 0;
    const bad = invert ? pct > 0 : pct < 0;
    return (
      <span
        className={`delta-badge ${good ? "good" : bad ? "bad" : ""}`}
        style={{ marginLeft: 6 }}
      >
        {pct > 0 ? "+" : ""}
        {pct.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="habit-tracker">
      <h2 className="page-title">Activity Clock</h2>

      <Card>
        <CardHeader>
          <h3>Now</h3>
          <Chip>{formatEdmonton(now)}</Chip>
        </CardHeader>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong>Start:</strong> {formatEdmonton(start)}
          </div>
          <div>
            <strong>Elapsed since start:</strong> {fmtM(elapsedMins)}
          </div>

          <div className="metric-input with-unit" style={{ gap: 8 }}>
            <input
              type="text"
              placeholder='What did you do? e.g., "Gym", "Sleep"'
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ac-border)",
                background: "#ffffff",
                color: "#0f172a",
              }}
            />
            <input
              type="number"
              min="1"
              placeholder="Minutes (optional)"
              value={minutesInput}
              onChange={(e) => setMinutesInput(e.target.value)}
              style={{
                width: 130,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ac-border)",
                background: "#ffffff",
                color: "#0f172a",
              }}
            />
            <button
              onClick={() =>
                logSinceLastStop(
                  undefined,
                  minutesInput ? Number(minutesInput) : undefined
                )
              }
              className="chip"
              style={{ cursor: "pointer" }}
            >
              Log segment
            </button>
            <button
              onClick={undoLast}
              className="chip"
              disabled={!lastLogged}
              style={{
                cursor: lastLogged ? "pointer" : "not-allowed",
                opacity: lastLogged ? 1 : 0.5,
              }}
            >
              Undo last
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--ac-muted)" }}>
            Leave minutes empty to log from <b>Start → now</b>. Set minutes to
            log just that many minutes <b>from Start</b> (e.g. 50m work, then
            10m break). <b>Undo last</b> removes the last logged chunk from the
            DB and restores the previous Start.
          </div>

          {names.length > 0 && (
            <div>
              <div
                style={{ fontSize: 12, color: "var(--ac-muted)", marginBottom: 6 }}
              >
                Quick pick
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {names.map((n) => (
                  <button
                    key={n}
                    className="chip"
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      logSinceLastStop(
                        n,
                        minutesInput ? Number(minutesInput) : undefined
                      )
                    }
                    title={
                      minutesInput
                        ? `Log ${minutesInput}m of "${n}" from Start`
                        : `Log "${n}" from Start to now`
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <DonutChart rows={todayBreakdown.rows} />
      </div>

      {/* Today vs Usual */}
      <Card className="summary-card">
        <CardHeader>
          <h3>Today vs Usual</h3>
          <Chip>
            {historical.dayCount} days of history since {START_DATE_ISO}
          </Chip>
        </CardHeader>

        <div className="summary-grid">
          <div className="stat">
            <div className="stat-label">Total tracked today</div>
            <div className="stat-value">
              {fmtM(todayBreakdown.totalTracked)}
              {historical.avgTrackedPerDay > 0 &&
                deltaBadge(
                  todayBreakdown.totalTracked,
                  historical.avgTrackedPerDay
                )}
            </div>
            <div className="stat-sub">
              Usual: {fmtM(historical.avgTrackedPerDay)} / day
            </div>
          </div>

          <div className="divider" />

          {historical.deltas
            .filter((d) => d.activity !== "Untracked")
            .slice(0, 6)
            .map((d) => (
              <div key={d.activity} className="stat">
                <div className="stat-label">{d.activity}</div>
                <div className="stat-value">
                  {fmtM(d.todayM)}
                  {d.avgM > 0 && deltaBadge(d.todayM, d.avgM)}
                </div>
                <div className="stat-sub">
                  Usual: {fmtM(d.avgM)} • Δ{" "}
                  {d.avgM ? `${d.delta >= 0 ? "+" : ""}${fmtM(d.delta)}` : "—"}
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Trends */}
      <Card className="summary-card">
        <CardHeader style={{ alignItems: "center", gap: 10 }}>
          <h3>Trends (since {START_DATE_ISO})</h3>
          <Chip>{historical.dayCount} days</Chip>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {(["All", "Weekdays", "Weekends"] as const).map((k) => (
              <button
                key={k}
                className={`ac-toggle ${trendScope === k ? "is-active" : ""}`}
                onClick={() => setTrendScope(k)}
                title={`Show ${k.toLowerCase()}`}
              >
                {trendScope === k ? "✓ " : ""}
                {k}
              </button>
            ))}
            {[7, 14, 30, 60].map((n) => (
              <button
                key={n}
                className={`ac-toggle ${trendDays === n ? "is-active" : ""}`}
                onClick={() => setTrendDays(n)}
                title={`Last ${n} days`}
              >
                {trendDays === n ? "✓ " : ""}
                {n}d
              </button>
            ))}
            <button
              className={`ac-toggle ${mode === "m" ? "is-active" : ""}`}
              onClick={() => setMode("m")}
              title="Show absolute minutes"
            >
              {mode === "m" ? "✓ " : ""}
              Minutes
            </button>
            <button
              className={`ac-toggle ${mode === "pct" ? "is-active" : ""}`}
              onClick={() => setMode("pct")}
              title="Show share of day"
            >
              {mode === "pct" ? "✓ " : ""}% of day
            </button>
          </div>
        </CardHeader>

        <div style={{ fontSize: 12, color: "var(--ac-muted)", marginBottom: 10 }}>
          Top {TOP_N} activities in window; others grouped as <b>Other</b>.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {chosenActivities.map((a) => (
            <div
              key={a}
              style={{
                opacity: focus && focus !== a ? 0.35 : 1,
                transition: "opacity .2s",
              }}
            >
              <ActivityCardMini
                name={a}
                series={series.byActivity}
                mode={mode}
                onFocus={(x) => setFocus(focus === x ? "" : x)}
                focused={focus === a}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {mode === "pct"
              ? "% of day per activity (lines)"
              : "Minutes per day (lines)"}
          </div>
          <MultiLinePerDay
            days={filteredTrendDays}
            seriesByActivity={series.byActivity}
            selectable={chosenActivities}
            selectedSet={selectedLines}
            mode={mode}
            onToggle={(name) => {
              setSelectedLines((prev) => {
                const next = new Set(prev);
                if (next.has(name)) next.delete(name);
                else next.add(name);
                if (next.size === 0) next.add(name); // keep at least one visible
                return next;
              });
            }}
          />
        </div>
      </Card>

      <VacationDaysPanel />

      {/* Today’s Breakdown */}
      <Card className="metrics-card">
        <CardHeader>
          <h3>Today’s Breakdown</h3>
          <Chip>
            Recorded {fmtM(todayBreakdown.totalTracked)} • Since midnight{" "}
            {fmtM(todayBreakdown.sinceMidnight)}
          </Chip>
        </CardHeader>
        <div className="metrics-grid">
          {todayBreakdown.rows.map((row) => (
            <div className="metric" key={row.activity}>
              <label>{row.activity}</label>
              <Bar pct={row.pct} />
              <span className="hint">
                {fmtM(row.minutes)} • {row.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <SessionsPanel
        filteredSessions={filteredSessions}
        sessionsSorted={sessionsSorted}
        mergeAdjacent={mergeAdjacent}
        showGaps={showGaps}
        activityFilter={activityFilter}
        setMergeAdjacent={setMergeAdjacent}
        setShowGaps={setShowGaps}
        setActivityFilter={setActivityFilter}
        activitiesToday={activitiesToday}
        totalTodayMins={totalTodayMins}
      />
      {loading && <Chip as="div">Loading…</Chip>}
    </div>
  );
}
