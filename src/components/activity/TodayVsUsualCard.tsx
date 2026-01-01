import React from "react";
import type { HistoricalSummary, TodayBreakdown } from "./types";
import { fmtM } from "./utils";
import { Card, CardHeader, Chip } from "../shared/Card";

type TodayVsUsualCardProps = {
  todayBreakdown: TodayBreakdown;
  historical: HistoricalSummary;
  startDateIso: string;
};

function DeltaBadge({
  todayVal,
  avgVal,
  invert = false,
}: {
  todayVal: number;
  avgVal: number;
  invert?: boolean;
}) {
  if (!avgVal) return null;
  const pct = ((todayVal - avgVal) / avgVal) * 100;
  const good = invert ? pct < 0 : pct > 0;
  const bad = invert ? pct > 0 : pct < 0;
  return (
    <span
      className={`delta-badge ${good ? "good" : bad ? "bad" : ""}`}
      style={{ marginLeft: 6 }}
    >
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export default function TodayVsUsualCard({
  todayBreakdown,
  historical,
  startDateIso,
}: TodayVsUsualCardProps) {
  return (
    <Card className="summary-card">
      <CardHeader>
        <h3>Today vs Usual</h3>
        <Chip>
          {historical.dayCount} days of history since {startDateIso}
        </Chip>
      </CardHeader>

      <div className="summary-grid">
        <div className="stat">
          <div className="stat-label">Total tracked today</div>
          <div className="stat-value">
            {fmtM(todayBreakdown.totalTracked)}
            {historical.avgTrackedPerDay > 0 && (
              <DeltaBadge
                todayVal={todayBreakdown.totalTracked}
                avgVal={historical.avgTrackedPerDay}
              />
            )}
          </div>
          <div className="stat-sub">
            Usual: {fmtM(historical.avgTrackedPerDay)} / day
          </div>
        </div>

        <div className="divider" />

        {historical.deltas
          .filter((d) => d.activity !== "Untracked")
          .slice(0, 6)
          .map((d) => (
            <div key={d.activity} className="stat">
              <div className="stat-label">{d.activity}</div>
              <div className="stat-value">
                {fmtM(d.todayM)}
                {d.avgM > 0 && (
                  <DeltaBadge todayVal={d.todayM} avgVal={d.avgM} />
                )}
              </div>
              <div className="stat-sub">
                Usual: {fmtM(d.avgM)} • Δ{" "}
                {d.avgM ? `${d.delta >= 0 ? "+" : ""}${fmtM(d.delta)}` : "—"}
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}
