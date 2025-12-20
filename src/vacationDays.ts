import { useCallback, useEffect, useState } from "react";

// Dates where streaks/analytics should be paused (YYYY-MM-DD in Edmonton time).
const VACATION_STORAGE_KEY = "activity_clock_vacation_days";
const VACATION_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VACATION_LISTENERS = new Set<(days: string[]) => void>();

let cachedVacationDays: string[] | null = null;
let cachedVacationSet = new Set<string>();

const hasStorage =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function normalizeVacationDays(days: string[]) {
  const cleaned = days
    .map((d) => String(d || "").trim())
    .filter((d) => VACATION_DATE_RE.test(d));
  return Array.from(new Set(cleaned)).sort();
}

function applyVacationDays(days: string[], persist: boolean) {
  const next = normalizeVacationDays(days);
  cachedVacationDays = next;
  cachedVacationSet = new Set(next);
  if (persist && hasStorage) {
    window.localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

function readStoredVacationDays() {
  if (!hasStorage) return [];
  try {
    const raw = window.localStorage.getItem(VACATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureVacationCache() {
  if (cachedVacationDays !== null) return;
  applyVacationDays(readStoredVacationDays(), false);
}

function emitVacationDays(days: string[]) {
  for (const listener of VACATION_LISTENERS) listener(days);
}

export function getVacationDays() {
  ensureVacationCache();
  return cachedVacationDays ? [...cachedVacationDays] : [];
}

export function setVacationDays(days: string[]) {
  const next = applyVacationDays(days, true);
  emitVacationDays(next);
  return next;
}

export function subscribeVacationDays(listener: (days: string[]) => void) {
  VACATION_LISTENERS.add(listener);
  return () => {
    VACATION_LISTENERS.delete(listener);
  };
}

export function isVacationDay(dateStr?: string | null) {
  ensureVacationCache();
  return !!dateStr && cachedVacationSet.has(dateStr);
}

export function useVacationDays(): [string[], (next: string[]) => void] {
  const [days, setDays] = useState<string[]>(getVacationDays());

  useEffect(() => {
    const unsubscribe = subscribeVacationDays((next) => setDays(next));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasStorage) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== VACATION_STORAGE_KEY) return;
      const next = applyVacationDays(readStoredVacationDays(), false);
      emitVacationDays(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: string[]) => {
    setVacationDays(next);
  }, []);

  return [days, update];
}

export function filterOutVacationMap<T extends Record<string, unknown>>(
  map: Record<string, T>
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) {
    if (!isVacationDay(k)) out[k] = v;
  }
  return out;
}

export function filterOutVacationLogs<T extends { date: string }>(
  logs: T[]
): T[] {
  return logs.filter((l) => !isVacationDay(l.date));
}
