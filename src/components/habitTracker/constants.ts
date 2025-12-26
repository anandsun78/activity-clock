export const HABITS = [
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
export const STUDY_KEYS = ["BK", "SD", "AP"] as const;
export const LEGACY_MAP: Record<string, string> = {
  BK: "leetcode",
  SD: "systemDesign",
  AP: "resumeApply",
};

// Aggregate ALL data since this date (inclusive) — string key in Edmonton time
export const START_DATE = "2025-12-01";

// Map counters -> timestamp keys for "last happened"
export const EVENT_KEYS: Record<string, string> = {
  newsAccessCount: "lastNewsTs",
  musicListenCount: "lastMusicTs",
  jlCount: "lastJlTs",
};
