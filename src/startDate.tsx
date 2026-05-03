import React, { createContext, useContext, useMemo, useState } from "react";
import { yyyyMmDdLocal } from "./dateUtils";

const START_DATE_STORAGE_KEY = "activity_clock_start_date";
export const DEFAULT_START_DATE_ISO = "2026-05-04";

type StartDateContextValue = {
  startDateIso: string;
  setStartDateIso: (value: string) => void;
};

const StartDateContext = createContext<StartDateContextValue | null>(null);

function readStoredStartDate() {
  if (typeof window === "undefined") return DEFAULT_START_DATE_ISO;
  return (
    normalizeStartDateInput(window.localStorage.getItem(START_DATE_STORAGE_KEY)) ||
    DEFAULT_START_DATE_ISO
  );
}

export function normalizeStartDateInput(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (yyyyMmDdLocal(parsed) !== trimmed) return null;
  if (trimmed > yyyyMmDdLocal()) return null;
  return trimmed;
}

export function StartDateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [startDateIso, setStartDateIsoState] = useState<string>(readStoredStartDate);

  const setStartDateIso = (value: string) => {
    const normalized = normalizeStartDateInput(value);
    if (!normalized) return;
    setStartDateIsoState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(START_DATE_STORAGE_KEY, normalized);
    }
  };

  const contextValue = useMemo(
    () => ({ startDateIso, setStartDateIso }),
    [startDateIso]
  );

  return (
    <StartDateContext.Provider value={contextValue}>
      {children}
    </StartDateContext.Provider>
  );
}

export function useStartDate() {
  const context = useContext(StartDateContext);
  if (!context) {
    throw new Error("useStartDate must be used within StartDateProvider");
  }
  return context;
}
