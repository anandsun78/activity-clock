import { useCallback, useEffect, useState } from "react";
import {
  EVENT_KEYS,
  LESS_WASTE_HABIT_LABEL,
  WASTE_LIMIT_MINUTES,
} from "./constants";
import { CONTENT_TYPE_JSON, HABITS_ENDPOINT } from "../../constants/api";
import type { HabitData, HabitHistoryMap } from "./types";
import { asNumOrNull, getStudyValFrom } from "./utils";

export function useHabitData(today: string) {
  const [habitData, setHabitData] = useState<HabitData>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${HABITS_ENDPOINT}/${today}`);
        const json = await res.json();
        const d = json?.data || {};
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

  const saveHabits = useCallback(
    async (updated: HabitData) => {
      const lessWasteKey = LESS_WASTE_HABIT_LABEL;
      const wm = asNumOrNull(updated.wastedMin);

      const computed = { ...updated };

      if (wm !== null) {
        computed[lessWasteKey] = wm <= WASTE_LIMIT_MINUTES;
        computed.wasteDelta = wm - WASTE_LIMIT_MINUTES;
      } else {
        delete computed[lessWasteKey];
        delete computed.wasteDelta;
      }

      setHabitData(computed);
      try {
        await fetch(`${HABITS_ENDPOINT}/${today}`, {
          method: "POST",
          headers: { "Content-Type": CONTENT_TYPE_JSON },
          body: JSON.stringify({ data: computed }),
        });
      } catch (err) {
        console.error("Error saving habits:", err);
      }
    },
    [today]
  );

  const toggleHabit = useCallback(
    (habit: string) => {
      if (habit === LESS_WASTE_HABIT_LABEL) return;
      const updated = { ...habitData, [habit]: !habitData[habit] };
      saveHabits(updated);
    },
    [habitData, saveHabits]
  );

  const updateNumber = useCallback(
    (key: string, value: string | number) => {
      const v = Number(value);
      const nextVal = Number.isFinite(v) ? Math.max(0, v) : 0;

      const prevRaw = habitData[key];
      const prev = Number.isFinite(prevRaw) ? prevRaw : 0;

      const updated = { ...habitData, [key]: nextVal };

      if (key in EVENT_KEYS) {
        if (nextVal > prev) {
          updated[EVENT_KEYS[key]] = new Date().toISOString();
        }
      }

      saveHabits(updated);
    },
    [habitData, saveHabits]
  );

  const updateStudy = useCallback(
    (key: string, value: string | number) => {
      const v = Number(value);
      const curStudy = habitData.study || {};
      const study = {
        ...curStudy,
        [key]: Number.isFinite(v) ? Math.max(0, v) : 0,
      };
      const updated = { ...habitData, study };
      saveHabits(updated);
    },
    [habitData, saveHabits]
  );

  const getStudyVal = useCallback(
    (k: string) => getStudyValFrom(k, habitData),
    [habitData]
  );

  return {
    habitData,
    loading,
    toggleHabit,
    updateNumber,
    updateStudy,
    getStudyVal,
  };
}

export function useHabitHistory(startDate: string, today: string) {
  const [history, setHistory] = useState<HabitHistoryMap>({});
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);

  useEffect(() => {
    const run = async () => {
      setHistoryLoading(true);
      try {
        const url = `${HABITS_ENDPOINT}?from=${startDate}&to=${today}`;
        const res = await fetch(url);
        const json = await res.json();

        const raw = json?.data || json?.items || json || {};
        let map: HabitHistoryMap = {};
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const d = item?.date || item?._id || "";
            if (typeof d === "string" && d) map[d] = item;
          }
        } else if (typeof raw === "object" && raw) {
          map = raw as HabitHistoryMap;
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
  }, [startDate, today]);

  return { history, historyLoading };
}
