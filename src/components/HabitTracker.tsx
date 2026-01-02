import React, { useEffect, useMemo } from "react";
// ⬇️ removed computeStreak import (it was using the wrong shape)
// import { computeStreak } from "../utils/streakUtils";
import "./HabitTracker.css";
import { yyyyMmDdLocal } from "../dateUtils"; // Local day key
import {
  filterOutVacationMap,
  isVacationDay,
  useVacationDays,
} from "../vacationDays";
import VacationDaysPanel from "./VacationDaysPanel";
import {
  HABITS,
  STUDY_KEYS,
  START_DATE,
  LESS_WASTE_HABIT_LABEL,
  WASTE_LIMIT_MINUTES,
} from "./habitTracker/constants";
import DailyMetrics from "./habitTracker/DailyMetrics";
import HabitList from "./habitTracker/HabitList";
import SummaryPanel from "./habitTracker/SummaryPanel";
import WeightChartCard from "./habitTracker/WeightChartCard";
import type {
  HabitAggregate,
  WeightDelta,
  WeightPoint,
} from "./habitTracker/types";
import { getStudyValFrom, isFiniteNum, minutesSince, safeAvg } from "./habitTracker/utils";
import { useHabitData, useHabitHistory } from "./habitTracker/hooks";

/**
 * Component: HabitTracker
 * - Tracks daily habits + numeric metrics (weight, wastedMin, study minutes by BK/SD/AP)
 * - Auto-computes the waste-limit habit when wastedMin is provided
 * - Persists per-day wasteDelta = wastedMin - WASTE_LIMIT_MINUTES (only when wastedMin is set)
 * - Adds 3 counters: newsAccessCount, musicListenCount, jlCount
 * - Shows per-day averages for those counters across observed days
 * - Shows per-day averages for BK/SD/AP/Waste and total study (BK+SD+AP)
 * - Shows "minutes since last" for each counter (only stamped on increase)
 * - Aggregates ALL data since START_DATE (inclusive)
 * - Weight trend coercion: handles string weights from backend
 * - DAY BOUNDARIES and "today" are in the user's local time zone
 */

const HabitTracker = () => {
  // "today" is the local day key
  const today = yyyyMmDdLocal();

  const [vacationDays] = useVacationDays();
  const { habitData, loading, toggleHabit, updateNumber, updateStudy, getStudyVal } =
    useHabitData(today);
  const { history, historyLoading } = useHabitHistory(START_DATE, today);

  useEffect(() => {
    document.title = "activity-clock – Habit Tracker";
  }, []);

  // ---------- derived (today) ----------
  const totalStudyMin = useMemo(
    () => STUDY_KEYS.reduce((acc, k) => acc + getStudyVal(k), 0),
    [getStudyVal]
  );

  const hasWastedToday = isFiniteNum(habitData.wastedMin);
  const wastedMin = hasWastedToday ? habitData.wastedMin : 0;
  const wasteDelta = hasWastedToday ? wastedMin - WASTE_LIMIT_MINUTES : 0;
  const overWasteLimit =
    hasWastedToday && wastedMin > WASTE_LIMIT_MINUTES;

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
  const filteredHistory = useMemo(
    () => filterOutVacationMap(history),
    [history, vacationDays]
  );

  const mergedHistory = useMemo(
    () =>
      isVacationDay(today)
        ? filteredHistory
        : { ...filteredHistory, [today]: habitData },
    [filteredHistory, habitData, today]
  );

  // ---------- aggregates (ALL data since START_DATE) ----------
  const aggregate = useMemo<HabitAggregate>(() => {
    const dates = Object.keys(mergedHistory)
      .filter((d) => d >= START_DATE && d <= today)
      .sort(); // ascending

    const sums: HabitAggregate = {
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
        const dDelta = hasWasteDelta
          ? day.wasteDelta
          : day.wastedMin - WASTE_LIMIT_MINUTES;
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
        typeof day[LESS_WASTE_HABIT_LABEL] !== "undefined" ||
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
  }, [mergedHistory, today]);

  // ---------- weight series for chart ----------
  const weightSeries = useMemo<WeightPoint[]>(() => {
    const dates = Object.keys(mergedHistory)
      .filter((d) => d >= START_DATE && d <= today)
      .sort(); // ascending

    const series: WeightPoint[] = [];
    for (const d of dates) {
      const raw = mergedHistory[d] || {};
      const w = Number(raw.weight);
      if (Number.isFinite(w) && w > 0) {
        series.push({ date: d, weight: w });
      }
    }
    return series;
  }, [mergedHistory, today]);

  const weightDelta = useMemo<WeightDelta | null>(() => {
    if (aggregate.firstWeight === null || aggregate.latestWeight === null)
      return null;
    const diff = aggregate.latestWeight - aggregate.firstWeight; // + gain, - loss
    const pct =
      aggregate.firstWeight > 0
        ? ((diff / aggregate.firstWeight) * 100).toFixed(1)
        : null;
    return { diff, pct };
  }, [aggregate.firstWeight, aggregate.latestWeight]);

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
      <HabitList
        habits={HABITS}
        habitData={habitData}
        mergedHistory={mergedHistory}
        onToggle={toggleHabit}
      />

      {/* Daily Metrics */}
      <DailyMetrics
        habitData={habitData}
        getStudyVal={getStudyVal}
        updateNumber={updateNumber}
        updateStudy={updateStudy}
        minsSinceAny={minsSinceAny}
        minsSinceNews={minsSinceNews}
        minsSinceMusic={minsSinceMusic}
        minsSinceJl={minsSinceJl}
        totalStudyMin={totalStudyMin}
        hasWastedToday={hasWastedToday}
        wastedMin={wastedMin}
        wasteDelta={wasteDelta}
        overWasteLimit={overWasteLimit}
      />

      {/* Weight graph over time */}
      <WeightChartCard series={weightSeries} />

      {/* Summary (ALL data since START_DATE) */}
      <SummaryPanel
        aggregate={aggregate}
        weightDelta={weightDelta}
        historyLoading={historyLoading}
        startDate={START_DATE}
      />
      <VacationDaysPanel />
    </div>
  );
};

export default HabitTracker;
