import React from "react";
import type { SeriesBundle, TrendDay } from "./types";
import { ActivityCardMini, MultiLinePerDay } from "./ActivityCharts";
import { Card, CardHeader, Chip } from "../shared/Card";

type TrendsCardProps = {
  startDateIso: string;
  dayCount: number;
  topN: number;
  trendScope: "All" | "Weekdays" | "Weekends";
  setTrendScope: (value: "All" | "Weekdays" | "Weekends") => void;
  trendDays: number;
  setTrendDays: (value: number) => void;
  mode: "m" | "pct";
  setMode: (value: "m" | "pct") => void;
  chosenActivities: string[];
  series: SeriesBundle;
  filteredTrendDays: TrendDay[];
  selectedLines: Set<string>;
  setSelectedLines: React.Dispatch<React.SetStateAction<Set<string>>>;
  focus: string;
  setFocus: (value: string) => void;
};

export default function TrendsCard({
  startDateIso,
  dayCount,
  topN,
  trendScope,
  setTrendScope,
  trendDays,
  setTrendDays,
  mode,
  setMode,
  chosenActivities,
  series,
  filteredTrendDays,
  selectedLines,
  setSelectedLines,
  focus,
  setFocus,
}: TrendsCardProps) {
  return (
    <Card className="summary-card">
      <CardHeader style={{ alignItems: "center", gap: 10 }}>
        <h3>Trends (since {startDateIso})</h3>
        <Chip>{dayCount} days</Chip>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {(["All", "Weekdays", "Weekends"] as const).map((k) => (
            <button
              key={k}
              className={`ac-toggle ${trendScope === k ? "is-active" : ""}`}
              onClick={() => setTrendScope(k)}
              title={`Show ${k.toLowerCase()}`}
            >
              {trendScope === k ? "✓ " : ""}
              {k}
            </button>
          ))}
          {[7, 14, 30, 60].map((n) => (
            <button
              key={n}
              className={`ac-toggle ${trendDays === n ? "is-active" : ""}`}
              onClick={() => setTrendDays(n)}
              title={`Last ${n} days`}
            >
              {trendDays === n ? "✓ " : ""}
              {n}d
            </button>
          ))}
          <button
            className={`ac-toggle ${mode === "m" ? "is-active" : ""}`}
            onClick={() => setMode("m")}
            title="Show absolute minutes"
          >
            {mode === "m" ? "✓ " : ""}
            Minutes
          </button>
          <button
            className={`ac-toggle ${mode === "pct" ? "is-active" : ""}`}
            onClick={() => setMode("pct")}
            title="Show share of day"
          >
            {mode === "pct" ? "✓ " : ""}% of day
          </button>
        </div>
      </CardHeader>

      <div style={{ fontSize: 12, color: "var(--ac-muted)", marginBottom: 10 }}>
        Top {topN} activities in window; others grouped as <b>Other</b>.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {chosenActivities.map((a) => (
          <div
            key={a}
            style={{
              opacity: focus && focus !== a ? 0.35 : 1,
              transition: "opacity .2s",
            }}
          >
            <ActivityCardMini
              name={a}
              series={series.byActivity}
              mode={mode}
              onFocus={(x) => setFocus(focus === x ? "" : x)}
              focused={focus === a}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          {mode === "pct"
            ? "% of day per activity (lines)"
            : "Minutes per day (lines)"}
        </div>
        <MultiLinePerDay
          days={filteredTrendDays}
          seriesByActivity={series.byActivity}
          selectable={chosenActivities}
          selectedSet={selectedLines}
          mode={mode}
          onToggle={(name) => {
            setSelectedLines((prev) => {
              const next = new Set(prev);
              if (next.has(name)) next.delete(name);
              else next.add(name);
              if (next.size === 0) next.add(name); // keep at least one visible
              return next;
            });
          }}
        />
      </div>
    </Card>
  );
}
