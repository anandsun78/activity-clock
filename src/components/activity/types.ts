export type Session = {
  start: string;
  end: string;
  activity: string;
};

export type DayLog = {
  date: string;
  sessions: Session[];
};

export type TrendDay = {
  date: string;
  weekend: boolean;
  totals: Record<string, number>;
  totalMin: number;
};

export type TrendPoint = {
  date: string;
  m: number;
  pct: number;
  weekend: boolean;
};

export type TrendSeries = Record<string, TrendPoint[]>;

export type LoggedSegments = {
  prevStart: string;
  segments: { start: string; end: string; activity: string }[];
} | null;

export type DonutRow = { activity: string; pct: number; minutes: number };
