export type HabitData = Record<string, any>;
export type HabitHistoryMap = Record<string, HabitData>;

export type HabitAggregate = {
  BK: number;
  SD: number;
  AP: number;
  totalStudy: number;
  totalWaste: number;
  totalWasteDelta: number;
  daysCounted: number;
  firstWeight: number | null;
  firstWeightDate: string | null;
  latestWeight: number | null;
  latestWeightDate: string | null;
  totalNewsAccess: number;
  totalMusicListen: number;
  totalJl: number;
  avgNewsPerDay: number;
  avgMusicPerDay: number;
  avgJlPerDay: number;
  avgBKPerDay: number;
  avgSDPerDay: number;
  avgAPPerDay: number;
  avgWastePerDay: number;
  avgTotalStudyPerDay: number;
  daysObserved: number;
};

export type WeightDelta = {
  diff: number;
  pct: string | null;
};

export type WeightPoint = {
  date: string;
  weight: number;
};
