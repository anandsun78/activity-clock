import React from "react";
import type { TodayBreakdown } from "./types";
import { fmtM } from "./utils";
import { Bar } from "./ActivityCharts";
import { Card, CardHeader, Chip } from "../shared/Card";

type TodayBreakdownCardProps = {
  todayBreakdown: TodayBreakdown;
};

export default function TodayBreakdownCard({
  todayBreakdown,
}: TodayBreakdownCardProps) {
  return (
    <Card className="metrics-card">
      <CardHeader>
        <h3>Today’s Breakdown</h3>
        <Chip>
          Recorded {fmtM(todayBreakdown.totalTracked)} • Since midnight{" "}
          {fmtM(todayBreakdown.sinceMidnight)}
        </Chip>
      </CardHeader>
      <div className="metrics-grid">
        {todayBreakdown.rows.map((row) => (
          <div className="metric" key={row.activity}>
            <label>{row.activity}</label>
            <Bar pct={row.pct} />
            <span className="hint">
              {fmtM(row.minutes)} • {row.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
