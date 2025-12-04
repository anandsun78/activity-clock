import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
// ⬇️ removed computeStreak import (it was using the wrong shape)
// import { computeStreak } from "../utils/streakUtils";
import "./HabitTracker.css";
import { yyyyMmDdEdmonton, startOfDayEdmonton } from "../dateUtils"; // Edmonton-aware day key + start-of-day

type HabitData = Record<string, any>;
type HabitHistoryMap = Record<string, HabitData>;

/**
 * Component: HabitTracker
 * - Tracks daily habits + numeric metrics (weight, wastedMin, study minutes by BK/SD/AP)
 * - Auto-computes "Less than 50m waste" when wastedMin is provided
 * - Persists per-day wasteDelta = wastedMin - 50 (only when wastedMin is set)
 * - Adds 3 counters: newsAccessCount, musicListenCount, jlCount
 * - Shows per-day averages for those counters across observed days
 * - Shows per-day averages for BK/SD/AP/Waste and total study (BK+SD+AP)
 * - Shows "minutes since last" for each counter (only stamped on increase)
 * - Aggregates ALL data since START_DATE (inclusive)
 * - Weight trend coercion: handles string weights from backend
 * - DAY BOUNDARIES and "today" are in America/Edmonton
 */

const HABITS = [
  "Daily Book",
  "Weight Check",
  "Cold Shower",
  "Sand",
  "Abishek",
  "Ab",
  "Pull/Push",
  "HIIT",
  "Steps",
  "LT",
  "Typing",
  "Proj",
  "Comm",
  "Less than 50m waste",
  "No news for the day",
  "No external music for the day",
];

// Study categories (renamed); includes legacy fallback mapping for old data
const STUDY_KEYS = ["BK", "SD", "AP"];
const LEGACY_MAP = { BK: "leetcode", SD: "systemDesign", AP: "resumeApply" };

// Aggregate ALL data since this date (inclusive) — string key in Edmonton time
const START_DATE = "2025-12-01";

// ---------- helpers ----------
const isFiniteNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const asNumOrNull = (v: unknown) => (isFiniteNum(v) ? (v as number) : null);
const safeAvg = (num: number, den: number) => (den > 0 ? num / den : 0);

// Map counters -> timestamp keys for "last happened"
const EVENT_KEYS = {
  newsAccessCount: "lastNewsTs",
  musicListenCount: "lastMusicTs",
  jlCount: "lastJlTs",
};

// Minutes since helper
const minutesSince = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
};

// ---------- per-habit streak helper (Edmonton-local) ----------
function getHabitStreak(habitName: string, historyMap: HabitHistoryMap) {
  // Walk backward from Edmonton midnight counting consecutive true days
  let streak = 0;
  let cursor = new Date(startOfDayEdmonton(new Date()));
  // guard against infinite loop if historyMap is empty
  for (let i = 0; i < 3660; i++) {
    // ~10 years max
    const key = yyyyMmDdEdmonton(cursor);
    const day = historyMap[key];
    if (!day || !day[habitName]) break;
    streak++;
    // move to previous local day
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

const HabitTracker = () => {
  // "today" is the Edmonton day key
  const today = yyyyMmDdEdmonton();

  const [habitData, setHabitData] = useState<HabitData>({});
  const [history, setHistory] = useState<HabitHistoryMap>({}); // { 'YYYY-MM-DD': {...} }
  const [loading, setLoading] = useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);

  useEffect(() => {
    document.title = "activity-clock – Habit Tracker";
  }, []);

  // ---------- load today's data ----------
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/.netlify/functions/habits/${today}`);
        const json = await res.json();
        const d = json?.data || {};
        // Coerce possible string weight to number
        if (typeof d.weight === "string") {
          const n = Number(d.weight);
          if (Number.isFinite(n)) d.weight = n;
        }
        setHabitData(d);
      } catch (err) {
        console.error("Error fetching habits:", err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [today]);

  // ---------- load ALL history since START_DATE ----------
  useEffect(() => {
    const run = async () => {
      setHistoryLoading(true);
      try {
        const url = `/.netlify/functions/habits?from=${START_DATE}&to=${today}`;
        const res = await fetch(url);
        const json = await res.json();

        const raw = json?.data || json?.items || json || {};
        let map = {};
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const d = item?.date || item?._id || "";
            if (typeof d === "string" && d) map[d] = item;
          }
        } else if (typeof raw === "object" && raw) {
          map = raw;
        }
        setHistory(map);
      } catch (err) {
        console.error("Error fetching history:", err);
        setHistory({});
      } finally {
        setHistoryLoading(false);
      }
    };
    run();
  }, [today]);

  // ---------- persist (auto-compute waste-related only if provided) ----------
  const saveHabits = async (updated) => {
    const lessWasteKey = "Less than 50m waste";
    const wm = asNumOrNull(updated.wastedMin);

    const computed = { ...updated };

    if (wm !== null) {
      computed[lessWasteKey] = wm <= 50;
      computed.wasteDelta = wm - 50; // store per-day delta
    } else {
      delete computed[lessWasteKey];
      delete computed.wasteDelta;
    }

    setHabitData(computed);
    try {
      await fetch(`/.netlify/functions/habits/${today}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: computed }),
      });
    } catch (err) {
      console.error("Error saving habits:", err);
    }
  };

  // ---------- UI updaters ----------
  const toggleHabit = (habit) => {
    if (habit === "Less than 50m waste") return; // computed; read-only
    const updated = { ...habitData, [habit]: !habitData[habit] };
    saveHabits(updated);
  };

  // Only stamp timestamp when the counter INCREASES
  const updateNumber = (key, value) => {
    const v = Number(value);
    const nextVal = Number.isFinite(v) ? Math.max(0, v) : 0;

    const prevRaw = habitData[key];
    const prev = Number.isFinite(prevRaw) ? prevRaw : 0;

    const updated = { ...habitData, [key]: nextVal };

    if (key in EVENT_KEYS) {
      if (nextVal > prev) {
        // increased -> stamp last*Ts
        updated[EVENT_KEYS[key]] = new Date().toISOString();
      }
      // if decreased or equal, do not change the timestamp
    }

    saveHabits(updated);
  };

  const updateStudy = (key, value) => {
    const v = Number(value);
    const curStudy = habitData.study || {};
    const study = {
      ...curStudy,
      [key]: Number.isFinite(v) ? Math.max(0, v) : 0,
    };
    const updated = { ...habitData, study };
    saveHabits(updated);
  };

  // ---------- study value helpers (with legacy fallback) ----------
  const getStudyValFrom = useCallback((k, data) => {
    const study = (data && data.study) || {};
    if (isFiniteNum(study[k])) return study[k];
    const legacyKey = LEGACY_MAP[k];
    if (isFiniteNum(study[legacyKey])) return study[legacyKey];
    return 0;
  }, []);

  const getStudyVal = useCallback(
    (k) => getStudyValFrom(k, habitData),
    [getStudyValFrom, habitData]
  );

  // ---------- derived (today) ----------
  const totalStudyMin = useMemo(
    () => STUDY_KEYS.reduce((acc, k) => acc + getStudyVal(k), 0),
    [getStudyVal]
  );

  const hasWastedToday = isFiniteNum(habitData.wastedMin);
  const wastedMin = hasWastedToday ? habitData.wastedMin : 0;
  const wasteDelta = hasWastedToday ? wastedMin - 50 : 0;
  const overWasteLimit = hasWastedToday && wastedMin > 50;

  // minutes since each new counter and since ANY of them
  const minsSinceNews = minutesSince(habitData.lastNewsTs);
  const minsSinceMusic = minutesSince(habitData.lastMusicTs);
  const minsSinceJl = minutesSince(habitData.lastJlTs);

  const lastAnyTs = [
    habitData.lastNewsTs,
    habitData.lastMusicTs,
    habitData.lastJlTs,
  ]
    .filter(Boolean)
    .map((s) => new Date(s).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0];
  const minsSinceAny = Number.isFinite(lastAnyTs)
    ? Math.max(0, Math.floor((Date.now() - lastAnyTs) / 60000))
    : null;

  // ---------- merge history with today (so fresh edits count) ----------
  const mergedHistory = useMemo(
    () => ({ ...history, [today]: habitData }),
    [history, habitData, today]
  );

  // ---------- aggregates (ALL data since START_DATE) ----------
  const aggregate = useMemo(() => {
    const dates = Object.keys(mergedHistory)
      .filter((d) => d >= START_DATE && d <= today)
      .sort(); // ascending

    const sums = {
      BK: 0,
      SD: 0,
      AP: 0,
      totalStudy: 0,
      totalWaste: 0,
      totalWasteDelta: 0,
      daysCounted: 0,
      firstWeight: null,
      firstWeightDate: null,
      latestWeight: null,
      latestWeightDate: null,
      totalNewsAccess: 0,
      totalMusicListen: 0,
      totalJl: 0,
      avgNewsPerDay: 0,
      avgMusicPerDay: 0,
      avgJlPerDay: 0,
      // new per-day study/waste avgs
      avgBKPerDay: 0,
      avgSDPerDay: 0,
      avgAPPerDay: 0,
      avgWastePerDay: 0,
      avgTotalStudyPerDay: 0,
      daysObserved: 0,
    };

    for (const d of dates) {
      const day = mergedHistory[d] || {};

      // study
      const bk = getStudyValFrom("BK", day);
      const sd = getStudyValFrom("SD", day);
      const ap = getStudyValFrom("AP", day);
      const dayStudy = bk + sd + ap;

      sums.BK += bk;
      sums.SD += sd;
      sums.AP += ap;
      sums.totalStudy += dayStudy;

      // waste (count only if provided)
      const hasWasteDelta = isFiniteNum(day.wasteDelta);
      const hasWastedMin = isFiniteNum(day.wastedMin);
      if (hasWasteDelta || hasWastedMin) {
        if (hasWastedMin) sums.totalWaste += day.wastedMin;
        const dDelta = hasWasteDelta ? day.wasteDelta : day.wastedMin - 50;
        sums.totalWasteDelta += dDelta;
      }

      // counters (treat missing as 0)
      if (isFiniteNum(day.newsAccessCount))
        sums.totalNewsAccess += day.newsAccessCount;
      if (isFiniteNum(day.musicListenCount))
        sums.totalMusicListen += day.musicListenCount;
      if (isFiniteNum(day.jlCount)) sums.totalJl += day.jlCount;

      // any meaningful input for daysCounted
      const w = Number(day.weight); // coerce weight from history
      const hasWeight = Number.isFinite(w) && w > 0;

      if (
        dayStudy > 0 ||
        hasWastedMin ||
        hasWeight ||
        typeof day["Less than 50m waste"] !== "undefined" ||
        isFiniteNum(day.newsAccessCount) ||
        isFiniteNum(day.musicListenCount) ||
        isFiniteNum(day.jlCount)
      ) {
        sums.daysCounted += 1;
      }

      // weight trend (coerced)
      if (hasWeight) {
        if (sums.firstWeight === null) {
          sums.firstWeight = w;
          sums.firstWeightDate = d;
        }
        sums.latestWeight = w;
        sums.latestWeightDate = d;
      }
    }

    // days present in window (inclusive)
    const daysObserved = dates.length;
    sums.daysObserved = daysObserved;

    // per-day averages across observed days (calendar days in the window)
    sums.avgNewsPerDay = safeAvg(sums.totalNewsAccess, daysObserved);
    sums.avgMusicPerDay = safeAvg(sums.totalMusicListen, daysObserved);
    sums.avgJlPerDay = safeAvg(sums.totalJl, daysObserved);

    // new: study/waste per-day averages
    sums.avgBKPerDay = safeAvg(sums.BK, daysObserved);
    sums.avgSDPerDay = safeAvg(sums.SD, daysObserved);
    sums.avgAPPerDay = safeAvg(sums.AP, daysObserved);
    sums.avgWastePerDay = safeAvg(sums.totalWaste, daysObserved);
    sums.avgTotalStudyPerDay = safeAvg(sums.totalStudy, daysObserved);

    return sums;
  }, [mergedHistory, getStudyValFrom, today]);

  // ---------- weight series for chart ----------
  const weightSeries = useMemo(() => {
    const dates = Object.keys(mergedHistory)
      .filter((d) => d >= START_DATE && d <= today)
      .sort(); // ascending

    const series = [];
    for (const d of dates) {
      const raw = mergedHistory[d] || {};
      const w = Number(raw.weight);
      if (Number.isFinite(w) && w > 0) {
        series.push({ date: d, weight: w });
      }
    }
    return series;
  }, [mergedHistory, today]);

  const weightDelta = useMemo(() => {
    if (aggregate.firstWeight === null || aggregate.latestWeight === null)
      return null;
    const diff = aggregate.latestWeight - aggregate.firstWeight; // + gain, - loss
    const pct =
      aggregate.firstWeight > 0
        ? ((diff / aggregate.firstWeight) * 100).toFixed(1)
        : null;
    return { diff, pct };
  }, [aggregate.firstWeight, aggregate.latestWeight]);

  // ---------- simple inline SVG chart for weight ----------
  let weightChart: {
    width: number;
    height: number;
    minW: number;
    maxW: number;
    points: string;
  } | null = null;
  let xForIndex: (i: number) => number = () => 0;
  let yForWeight: (w: number) => number = () => 0;
  const weightSvgRef = useRef(null);
  const [hoverPoint, setHoverPoint] = useState(null);

  if (weightSeries.length > 0) {
    const width = 600;
    const height = 220;
    const padding = 32;

    const weights = weightSeries.map((p) => p.weight);
    let minW = Math.min(...weights);
    let maxW = Math.max(...weights);

    // add a small margin so line isn't glued to edges
    const margin = 0.5;
    minW -= margin;
    maxW += margin;

    if (minW === maxW) {
      minW -= 1;
      maxW += 1;
    }

    const innerWidth = width - 2 * padding;
    const innerHeight = height - 2 * padding;

    xForIndex = (i) => {
      if (weightSeries.length === 1) return width / 2;
      return padding + (i / (weightSeries.length - 1)) * innerWidth;
    };

    yForWeight = (w) => {
      const t = (w - minW) / (maxW - minW || 1); // 0 at min, 1 at max
      return padding + (1 - t) * innerHeight;
    };

    const points = weightSeries
      .map((p, i) => `${xForIndex(i)},${yForWeight(p.weight)}`)
      .join(" ");

    weightChart = {
      width,
      height,
      minW,
      maxW,
      points,
    };
  }

  if (loading) {
    return (
      <div className="habit-tracker">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="habit-tracker">
      <h2 className="page-title">{today}</h2>

      {/* Habits */}
      <ul className="habit-list">
        {HABITS.map((habit) => {
          const done = habitData[habit] || false;
          // ✅ FIX: compute streak using the full merged history for this habit
          const streak = getHabitStreak(habit, mergedHistory);
          const isComputed = habit === "Less than 50m waste";
          return (
            <li key={habit} className={`habit-card ${done ? "done" : ""}`}>
              <label className="habit-label">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleHabit(habit)}
                  disabled={isComputed}
                  title={isComputed ? "Auto-set from wasted minutes" : ""}
                />
                {habit}
                {isComputed && <span className="auto-badge">auto</span>}
              </label>
              <span className={`streak ${streak > 0 ? "active" : ""}`}>
                🔥 {streak}d
              </span>
            </li>
          );
        })}
      </ul>

      {/* Daily Metrics */}
      <section className="card metrics-card">
        <div className="card-header">
          <h3>Daily Metrics</h3>
          <div className="chip">Tracked per day</div>
          <div className="chip">
            ⏱ Since any: {minsSinceAny === null ? "—" : `${minsSinceAny}m`}
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric">
            <label>Weight</label>
            <div className="metric-input with-unit">
              <input
                type="number"
                step="0.1"
                value={habitData.weight ?? ""}
                placeholder="e.g., 175.2"
                onChange={(e) => updateNumber("weight", e.target.value)}
              />
              <span className="unit">lbs</span>
            </div>
          </div>

          <div className={`metric ${overWasteLimit ? "warn" : ""}`}>
            <label>Wasted (min)</label>
            <input
              type="number"
              min="0"
              value={hasWastedToday ? habitData.wastedMin : ""}
              placeholder="0"
              onChange={(e) => updateNumber("wastedMin", e.target.value)}
            />
            <small className="hint">
              {overWasteLimit ? "Over 50m limit" : "≤ 50m target"}
            </small>
          </div>

          <div className="metric">
            <label>BK (min)</label>
            <input
              type="number"
              min="0"
              value={getStudyVal("BK")}
              placeholder="0"
              onChange={(e) => updateStudy("BK", e.target.value)}
            />
          </div>

          <div className="metric">
            <label>SD (min)</label>
            <input
              type="number"
              min="0"
              value={getStudyVal("SD")}
              placeholder="0"
              onChange={(e) => updateStudy("SD", e.target.value)}
            />
          </div>

          <div className="metric">
            <label>AP (min)</label>
            <input
              type="number"
              min="0"
              value={getStudyVal("AP")}
              placeholder="0"
              onChange={(e) => updateStudy("AP", e.target.value)}
            />
          </div>

          {/* # News Accesses */}
          <div className="metric">
            <label># News Accesses</label>
            <input
              type="number"
              min="0"
              value={
                isFiniteNum(habitData.newsAccessCount)
                  ? habitData.newsAccessCount
                  : ""
              }
              placeholder="0"
              onChange={(e) => updateNumber("newsAccessCount", e.target.value)}
            />
            <small className="hint">
              Last: {minsSinceNews === null ? "—" : `${minsSinceNews}m ago`}
            </small>
          </div>

          {/* # Music Listens */}
          <div className="metric">
            <label># Music Listens</label>
            <input
              type="number"
              min="0"
              value={
                isFiniteNum(habitData.musicListenCount)
                  ? habitData.musicListenCount
                  : ""
              }
              placeholder="0"
              onChange={(e) => updateNumber("musicListenCount", e.target.value)}
            />
            <small className="hint">
              Last: {minsSinceMusic === null ? "—" : `${minsSinceMusic}m ago`}
            </small>
          </div>

          {/* # JL */}
          <div className="metric">
            <label># JL</label>
            <input
              type="number"
              min="0"
              value={isFiniteNum(habitData.jlCount) ? habitData.jlCount : ""}
              placeholder="0"
              onChange={(e) => updateNumber("jlCount", e.target.value)}
            />
            <small className="hint">
              Last: {minsSinceJl === null ? "—" : `${minsSinceJl}m ago`}
            </small>
          </div>
        </div>

        <div className="totals">
          <div className="total">
            <strong>Total SD:</strong> {totalStudyMin} min
          </div>
          <div className={`total ${overWasteLimit ? "warn" : "ok"}`}>
            <strong>Waste:</strong> {wastedMin} min
            {hasWastedToday && (
              <span
                className={`delta-badge ${
                  wasteDelta > 0 ? "bad" : wasteDelta < 0 ? "good" : ""
                }`}
              >
                {wasteDelta > 0 ? `+${wasteDelta}` : wasteDelta}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Weight graph over time */}
      <section className="card weight-chart-card">
        <div className="card-header">
          <h3>Weight (graph)</h3>
          <div className="chip">Trend over time</div>
        </div>

        {weightSeries.length === 0 || !weightChart ? (
          <p>No weight data yet. Add some daily weights to see the graph.</p>
        ) : (
          <>
            <div className="weight-chart-wrapper">
              <svg
                ref={weightSvgRef}
                className="weight-chart-svg"
                viewBox={`0 0 ${weightChart.width} ${weightChart.height}`}
                preserveAspectRatio="none"
                onMouseLeave={() => setHoverPoint(null)}
              >
                {/* X-axis */}
                <line
                  x1="24"
                  y1={weightChart.height - 24}
                  x2={weightChart.width - 24}
                  y2={weightChart.height - 24}
                  stroke="#d1d5db"
                  strokeWidth="1"
                />
                {/* Y-axis */}
                <line
                  x1="24"
                  y1="24"
                  x2="24"
                  y2={weightChart.height - 24}
                  stroke="#d1d5db"
                  strokeWidth="1"
                />

                {/* line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={weightChart.points}
                />

                {/* points */}
                {weightSeries.map((p, i) => (
                  <circle
                    key={p.date}
                    cx={xForIndex(i)}
                    cy={yForWeight(p.weight)}
                    r="4"
                    fill="#1d4ed8"
                    onMouseEnter={(e) => {
                      const rect =
                        weightSvgRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setHoverPoint({
                        left: e.clientX - rect.left,
                        top: e.clientY - rect.top - 12,
                        date: p.date,
                        weight: p.weight,
                      });
                    }}
                    onFocus={() => {}}
                  />
                ))}

                {/* min/max labels on Y-axis */}
                <text x="28" y="32" fontSize="10" fill="#6b7280">
                  {weightChart.maxW.toFixed(1)} lbs
                </text>
                <text
                  x="28"
                  y={weightChart.height - 28}
                  fontSize="10"
                  fill="#6b7280"
                >
                  {weightChart.minW.toFixed(1)} lbs
                </text>

                {/* first & last date labels on X-axis */}
                <text
                  x={xForIndex(0)}
                  y={weightChart.height - 10}
                  fontSize="9"
                  textAnchor="middle"
                  fill="#6b7280"
                >
                  {weightSeries[0].date.slice(5)}
                </text>
                <text
                  x={xForIndex(weightSeries.length - 1)}
                  y={weightChart.height - 10}
                  fontSize="9"
                  textAnchor="middle"
                  fill="#6b7280"
                >
                  {weightSeries[weightSeries.length - 1].date.slice(5)}
                </text>
              </svg>
              {hoverPoint && (
                <div
                  className="weight-tooltip"
                  style={{ left: hoverPoint.left, top: hoverPoint.top }}
                >
                  <div className="tooltip-date">{hoverPoint.date}</div>
                  <div className="tooltip-weight">
                    {hoverPoint.weight.toFixed(1)} lbs
                  </div>
                </div>
              )}
            </div>

            <div className="weight-chart-footer">
              <span>
                First: {weightSeries[0].weight.toFixed(1)} lbs (
                {weightSeries[0].date})
              </span>
              <span>
                Latest:{" "}
                {weightSeries[weightSeries.length - 1].weight.toFixed(1)} lbs (
                {weightSeries[weightSeries.length - 1].date})
              </span>
            </div>
          </>
        )}
      </section>

      {/* Summary (ALL data since START_DATE) */}
      <section className="card summary-card">
        <div className="card-header">
          <h3>Summary (since {START_DATE})</h3>
          {historyLoading ? (
            <div className="chip">Loading…</div>
          ) : (
            <div className="chip">Aggregated</div>
          )}
        </div>

        <div className="summary-grid">
          <div className="stat">
            <div className="stat-label">BK</div>
            <div className="stat-value">{aggregate.BK} min</div>
          </div>
          <div className="stat">
            <div className="stat-label">SD</div>
            <div className="stat-value">{aggregate.SD} min</div>
          </div>
          <div className="stat">
            <div className="stat-label">AP</div>
            <div className="stat-value">{aggregate.AP} min</div>
          </div>

          <div className="divider" />

          <div className="stat">
            <div className="stat-label">Total SD</div>
            <div className="stat-value emphasis">
              {aggregate.totalStudy} min
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Total Waste</div>
            <div className="stat-value">{aggregate.totalWaste} min</div>
          </div>
          <div
            className={`stat ${aggregate.totalWasteDelta > 0 ? "warn" : "ok"}`}
          >
            <div className="stat-label">Waste Allowance Δ</div>
            <div className="stat-value emphasis">
              {aggregate.totalWasteDelta > 0
                ? `+${aggregate.totalWasteDelta}`
                : aggregate.totalWasteDelta}
            </div>
            <div className="stat-sub">
              Sum of (wasted − 50) on days with input
            </div>
          </div>

          <div className="divider" />

          <div className="stat weight-trend">
            <div className="stat-label">Weight Trend</div>
            {aggregate.firstWeight === null ||
            aggregate.latestWeight === null ? (
              <div className="stat-value">—</div>
            ) : (
              <>
                <div className="stat-value">
                  {aggregate.firstWeight} → {aggregate.latestWeight} lbs
                </div>
                <div className="stat-sub">
                  First: {aggregate.firstWeightDate} · Latest:{" "}
                  {aggregate.latestWeightDate}
                </div>
                {weightDelta && (
                  <div
                    className={`delta-badge ${
                      weightDelta.diff < 0
                        ? "good"
                        : weightDelta.diff > 0
                        ? "bad"
                        : ""
                    }`}
                    style={{ marginTop: 6 }}
                  >
                    {weightDelta.diff > 0 ? "+" : ""}
                    {weightDelta.diff.toFixed(1)} lbs
                    {weightDelta.pct !== null ? ` (${weightDelta.pct}%)` : ""}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Per-day averages for news/music/JL */}
          <div className="divider" />

          <div className="stat">
            <div className="stat-label">Avg News / day</div>
            <div className="stat-value">
              {aggregate.avgNewsPerDay.toFixed(2)}
            </div>
            <div className="stat-sub">
              Total: {aggregate.totalNewsAccess} across {aggregate.daysObserved}{" "}
              day{aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Avg Music / day</div>
            <div className="stat-value">
              {aggregate.avgMusicPerDay.toFixed(2)}
            </div>
            <div className="stat-sub">
              Total: {aggregate.totalMusicListen} across{" "}
              {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Avg JL / day</div>
            <div className="stat-value">{aggregate.avgJlPerDay.toFixed(2)}</div>
            <div className="stat-sub">
              Total: {aggregate.totalJl} across {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          {/* Per-day averages for BK/SD/AP/Waste/Total Study */}
          <div className="divider" />

          <div className="stat">
            <div className="stat-label">Avg BK / day</div>
            <div className="stat-value">{aggregate.avgBKPerDay.toFixed(2)}</div>
            <div className="stat-sub">
              Total: {aggregate.BK} across {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Avg SD / day</div>
            <div className="stat-value">{aggregate.avgSDPerDay.toFixed(2)}</div>
            <div className="stat-sub">
              Total: {aggregate.SD} across {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Avg AP / day</div>
            <div className="stat-value">{aggregate.avgAPPerDay.toFixed(2)}</div>
            <div className="stat-sub">
              Total: {aggregate.AP} across {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Avg Waste / day</div>
            <div className="stat-value">
              {aggregate.avgWastePerDay.toFixed(2)} min
            </div>
            <div className="stat-sub">
              Total: {aggregate.totalWaste} across {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Avg Total SD / day</div>
            <div className="stat-value">
              {aggregate.avgTotalStudyPerDay.toFixed(2)} min
            </div>
            <div className="stat-sub">
              (BK + SD + AP) · Total: {aggregate.totalStudy} across{" "}
              {aggregate.daysObserved} day
              {aggregate.daysObserved === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HabitTracker;
