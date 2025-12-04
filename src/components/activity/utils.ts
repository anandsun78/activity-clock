const PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#eab308",
  "#f97316",
  "#22c55e",
  "#ec4899",
  "#9ca3af",
  "#0ea5e9",
  "#a855f7",
  "#14b8a6",
  "#84cc16",
  "#fb7185",
  "#f472b6",
  "#94a3b8",
];

export function colorForActivity(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// minutes-only formatter (rounded to whole minutes)
export const fmtM = (m: number) => `${Math.round(Number(m) || 0)}m`;
