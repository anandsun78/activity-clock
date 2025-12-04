import React, { useEffect, useMemo, useState } from "react";
import "./HabitTracker.css";
import "./ActivityClock.css";
import {
  yyyyMmDdEdmonton,
  formatEdmonton,
  formatEdmontonTime,
  diffMinutes,
  startOfDayEdmonton,
  minutesSinceEdmontonMidnight,
} from "../dateUtils";
import { colorForActivity, fmtM } from "./activity/utils";
import SessionsPanel from "./activity/SessionsPanel";

type Session = {
  start: string;
  end: string;
  activity: string;
};

type DayLog = {
  date: string;
  sessions: Session[];
};

type TrendDay = {
  date: string;
  weekend: boolean;
  totals: Record<string, number>;
  totalMin: number;
};

type TrendPoint = {
  date: string;
  m: number;
  pct: number;
  weekend: boolean;
};

type TrendSeries = Record<string, TrendPoint[]>;

type LoggedSegments = {
  prevStart: string;
  segments: { start: string; end: string; activity: string }[];
} | null;

const START_DATE_ISO = "2025-12-01";
const TOP_N = 7;
function isWeekend(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const x = d.getDay();
  return x === 0 || x === 6;
}

/* ---------- helpers ---------- */
function aggregateTopN(
  totalsMap: Record<string, number>,
  topN = TOP_N
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
function buildSeries(days: TrendDay[], chosenActivities: string[]) {
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

/* Keep Trends in sync with today's edits */
function upsertTodayInHistory(
  prevHistory: DayLog[],
  newDayDoc: DayLog
): DayLog[] {
  const idx = prevHistory.findIndex((d) => d?.date === newDayDoc.date);
  if (idx === -1) return [...prevHistory, newDayDoc];
  const copy = prevHistory.slice();
  copy[idx] = newDayDoc;
  return copy;
}

/* ---------- tiny charts kept ---------- */
type DonutRow = { activity: string; pct: number; minutes: number };

function DonutChart({ rows }: { rows: DonutRow[] }) {
  const size = 180,
    stroke = 24,
    radius = (size - stroke) / 2,
    circ = 2 * Math.PI * radius;
  const filtered = rows.filter((r) => r.pct > 0.2);
  let offset = 0;
  const legendGrid = {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "start",
    minWidth: 220,
    flex: 1,
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          {filtered.map((r) => {
            const len = (r.pct / 100) * circ;
            const dasharray = `${len} ${circ - len}`;
            const dashoffset = circ * offset;
            offset += r.pct / 100;
            return (
              <circle
                key={r.activity}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colorForActivity(r.activity)}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            );
          })}
        </g>
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="14"
          fill="#0f172a"
        >
          Today (%)
        </text>
      </svg>
      <div style={legendGrid}>
        {filtered.map((r) => (
          <div
            key={r.activity}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
            title={`${r.activity} — ${r.pct.toFixed(1)}% • ${Math.round(
              r.minutes
            )}m`}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colorForActivity(r.activity),
              }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.activity}
                </div>
                <div style={{ fontSize: 12, color: "var(--ac-muted)" }}>
                  {r.pct.toFixed(1)}% • {Math.round(r.minutes)}m
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
function Bar({ pct }) {
  return (
    <div
      style={{
        background: "#e2e8f0",
        borderRadius: 8,
        height: 10,
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`,
          height: 10,
          borderRadius: 8,
          background: "linear-gradient(90deg, #a855f7, #22d3ee)",
        }}
      />
    </div>
  );
}

/* ---------- Multi-series Minutes/% per day line chart with toggles ---------- */
type MultiLinePerDayProps = {
  days: TrendDay[];
  seriesByActivity: TrendSeries;
  selectable: string[];
  selectedSet: Set<string>;
  onToggle: (name: string) => void;
  mode: "m" | "pct";
};

function MultiLinePerDay({
  days,
  seriesByActivity,
  selectable,
  selectedSet,
  onToggle,
  mode,
}: MultiLinePerDayProps) {
  const pad = { l: 44, r: 12, t: 10, b: 26 };
  const W = 760,
    H = 240;
  const stepX = days.length > 1 ? (W - pad.l - pad.r) / (days.length - 1) : 0;

  const visibles = selectable.filter((a) => selectedSet.has(a));
  const key = mode === "pct" ? "pct" : "m";

  let maxY;
  if (mode === "pct") {
    const maxSeen = Math.max(
      1,
      ...visibles.flatMap((a) =>
        (seriesByActivity[a] || []).map((p) => p.pct || 0)
      )
    );
    maxY = Math.min(100, Math.max(25, Math.ceil(maxSeen / 10) * 10));
  } else {
    const maxSeen = Math.max(
      1,
      ...visibles.flatMap((a) =>
        (seriesByActivity[a] || []).map((p) => p.m || 0)
      )
    );
    maxY = Math.max(60, Math.ceil(maxSeen / 30) * 30);
  }
  const yToPix = (v) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);

  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - pad.l;
    const i = Math.round(x / stepX);
    if (i >= 0 && i < days.length) setHover({ i, x: pad.l + i * stepX });
  };
  const onLeave = () => setHover(null);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={W}
        height={H}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          background: "#ffffff",
          border: "1px solid var(--ac-border)",
          borderRadius: 12,
        }}
      >
        {days.map((d, i) =>
          d.weekend && stepX > 0 ? (
            <rect
              key={`wk-${i}`}
              x={pad.l + i * stepX - stepX / 2}
              y={pad.t}
              width={stepX}
              height={H - pad.t - pad.b}
              fill="#94a3b8"
              opacity="0.12"
            />
          ) : null
        )}

        <line
          x1={pad.l}
          y1={H - pad.b}
          x2={W - pad.r}
          y2={H - pad.b}
          stroke="rgba(255,255,255,0.16)"
        />
        <line
          x1={pad.l}
          y1={pad.t}
          x2={W - pad.r}
          y2={H - pad.b}
          stroke="rgba(255,255,255,0.16)"
        />

        {[0, 0.25, 0.5, 0.75, 1].map((fr) => {
          const y = yToPix(fr * maxY);
          const label =
            mode === "pct" ? `${Math.round(fr * maxY)}%` : fmtM(fr * maxY);
          return (
            <g key={fr}>
              <line
                x1={pad.l}
                y1={y}
                x2={W - pad.r}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={pad.l - 6}
                y={y}
                textAnchor="end"
                alignmentBaseline="middle"
                fontSize="11"
                fill="#cbd5e1"
              >
                {label}
              </text>
            </g>
          );
        })}

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.date}
              x={pad.l + i * stepX}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#cbd5e1"
            >
              {d.date.slice(5)}
            </text>
          ) : null
        )}

        {visibles.map((name) => {
          const pts = seriesByActivity[name] || [];
          const d = pts
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${pad.l + i * stepX},${yToPix(
                  p[key] || 0
                )}`
            )
            .join(" ");
          const c = colorForActivity(name);
          return (
            <path key={name} d={d} fill="none" stroke={c} strokeWidth="2" />
          );
        })}

        {hover && (
          <>
            <line
              x1={hover.x}
              y1={pad.t}
              x2={hover.x}
              y2={H - pad.b}
              stroke="#9ca3af"
              strokeDasharray="4 4"
            />
            {visibles.map((name) => {
              const pts = seriesByActivity[name] || [];
              const p = pts[hover.i];
              if (!p) return null;
              return (
                <circle
                  key={`dot-${name}`}
                  cx={hover.x}
                  cy={yToPix(p[key] || 0)}
                  r="3"
                  fill={colorForActivity(name)}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              );
            })}
          </>
        )}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {selectable.map((name) => {
          const active = selectedSet.has(name);
          const c = colorForActivity(name);
          return (
            <button
              key={name}
              onClick={() => onToggle(name)}
              style={{
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 10,
                border: `1px solid ${active ? c : "#e5e7eb"}`,
                background: active ? "#ffffff" : "#f8fafc",
                color: "#111827",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              title={active ? "Hide" : "Show"}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: c,
                  opacity: active ? 1 : 0.35,
                }}
              />
              {name}
              {active && (
                <span style={{ fontSize: 11, color: "var(--ac-muted)" }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {hover && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fff",
            display: "inline-block",
            minWidth: 220,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {days[hover.i].date}
          </div>
          {visibles.map((n) => {
            const p = seriesByActivity[n]?.[hover.i];
            const val =
              mode === "pct" ? `${Math.round(p?.pct || 0)}%` : fmtM(p?.m || 0);
            return (
              <div
                key={`t-${n}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: colorForActivity(n),
                    }}
                  />
                  {n}
                </div>
                <div style={{ color: "#374151" }}>{val}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------ Small-multiples sparkline (kept) ------------ */
function Sparkline({
  points,
  mode = "m",
  color,
  height = 44,
  pad = 4,
}: {
  points: TrendPoint[];
  mode?: "m" | "pct";
  color: string;
  height?: number;
  pad?: number;
}) {
  const w = 160,
    h = height,
    key = mode === "pct" ? "pct" : "m";
  const vals = points.map((p) => p[key]);
  const max = Math.max(1, ...vals);
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const weekendRects = points.map((p, i) =>
    p.weekend ? (
      <rect
        key={`wk-${i}`}
        x={pad + i * stepX - stepX / 2}
        y={pad}
        width={stepX}
        height={h - pad * 2}
        fill="#94a3b8"
        opacity="0.12"
      />
    ) : null
  );
  const linePts = points
    .map(
      (p, i) => `${pad + i * stepX},${pad + (1 - p[key] / max) * (h - pad * 2)}`
    )
    .join(" ");
  const last = points[points.length - 1];
  const lastVal = last ? last[key] : 0;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect
        x="0"
        y="0"
        width={w}
        height={h}
        fill="#ffffff"
        rx="8"
      />
      {weekendRects}
      <polyline fill="none" stroke={color} strokeWidth="2" points={linePts} />
      {points.length > 0 && (
        <circle
          cx={pad + (points.length - 1) * stepX}
          cy={pad + (1 - lastVal / max) * (h - pad * 2)}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}
function ActivityCardMini({
  name,
  series,
  mode,
  onFocus,
  focused,
}: {
  name: string;
  series: TrendSeries;
  mode: "m" | "pct";
  onFocus: (name: string) => void;
  focused: boolean;
}) {
  const color = colorForActivity(name);
  const v = series[name] || [];
  const last = v[v.length - 1];
  const metric =
    mode === "pct" ? `${(last?.pct ?? 0).toFixed(0)}%` : fmtM(last?.m ?? 0);
  return (
    <div
      onClick={() => onFocus(name)}
      style={{
        border: `1px solid ${focused ? color : "var(--ac-border)"}`,
        background: "#ffffff",
        borderRadius: 12,
        padding: 10,
        cursor: "pointer",
        boxShadow: focused
          ? "0 6px 14px rgba(0,0,0,0.24)"
          : "0 4px 10px rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{ width: 10, height: 10, borderRadius: 2, background: color }}
        />
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ac-muted)" }}>{metric}</div>
      </div>
      <Sparkline points={v} mode={mode} color={color} />
      <div style={{ fontSize: 11, color: "var(--ac-muted)", marginTop: 6 }}>
        {mode === "pct"
          ? "Last days (% of day). Shaded = weekend."
          : "Last days (minutes). Shaded = weekend."}
      </div>
    </div>
  );
}

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

  // Historical (per day averages)
  const historical = useMemo(() => {
    const perDayTotals: Record<
      string,
      { totalMinutes: number; daysWithAny: number }
    > = {};
    let dayCount = 0;
    let sumDailyTracked = 0;
    for (const log of history) {
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
  }, [history, todayBreakdown]);

  // Build days + activity list for trends
  const trendData = useMemo(() => {
    const todayKey = yyyyMmDdEdmonton(now);
    const days = history.map((log) => {
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
  }, [history, now]);

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

  // Helper: split session by Edmonton midnights so each piece lands on the correct day
  function splitByEdmontonMidnight(startD, endD) {
    const segs = [];
    let a = new Date(startD);
    const end = new Date(endD);

    const mid = (d) => startOfDayEdmonton(new Date(d));
    const nextMid = (d) => new Date(mid(d).getTime() + 24 * 60 * 60000);

    while (yyyyMmDdEdmonton(a) !== yyyyMmDdEdmonton(end)) {
      const cut = nextMid(a);
      segs.push({ start: a, end: cut });
      a = cut;
    }
    segs.push({ start: a, end });
    return segs;
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

      <div className="card">
        <div className="card-header">
          <h3>Now</h3>
          <span className="chip">{formatEdmonton(now)}</span>
        </div>

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
      </div>

      <div style={{ marginBottom: 16 }}>
        <DonutChart rows={todayBreakdown.rows} />
      </div>

      {/* Today vs Usual */}
      <section className="card summary-card">
        <div className="card-header">
          <h3>Today vs Usual</h3>
          <span className="chip">
            {historical.dayCount} days of history since {START_DATE_ISO}
          </span>
        </div>

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
      </section>

      {/* Trends */}
      <div className="card summary-card">
        <div className="card-header" style={{ alignItems: "center", gap: 10 }}>
          <h3>Trends (since {START_DATE_ISO})</h3>
          <span className="chip">{historical.dayCount} days</span>
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
        </div>

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
      </div>

      {/* Today’s Breakdown */}
      <div className="card metrics-card">
        <div className="card-header">
          <h3>Today’s Breakdown</h3>
          <span className="chip">
            Recorded {fmtM(todayBreakdown.totalTracked)} • Since midnight{" "}
            {fmtM(todayBreakdown.sinceMidnight)}
          </span>
        </div>
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
      </div>

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

      {loading && <div className="chip">Loading…</div>}
    </div>
  );
}
