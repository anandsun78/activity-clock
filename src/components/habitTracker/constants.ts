export const WASTE_LIMIT_MINUTES = 50;
export const HABITS = [
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
  "Comm",
  "No mins wasted AT ALL"
];

// Study categories (renamed); includes legacy fallback mapping for old data
export const STUDY_KEYS = ["BK", "SD", "AP"] as const;
export const LEGACY_MAP: Record<string, string> = {
  BK: "leetcode",
  SD: "systemDesign",
  AP: "resumeApply",
};

// Aggregate ALL data since this date (inclusive) — string key in local time
export const START_DATE = "2026-02-16";

// Map counters -> timestamp keys for "last happened"
export const EVENT_KEYS: Record<string, string> = {
  newsAccessCount: "lastNewsTs",
  musicListenCount: "lastMusicTs",
  jlCount: "lastJlTs",
};
