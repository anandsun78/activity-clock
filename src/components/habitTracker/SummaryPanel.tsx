import React from "react";
import type { HabitAggregate, WeightDelta } from "./types";
import { Card, CardHeader, Chip } from "../shared/Card";
import { WASTE_LIMIT_MINUTES } from "./constants";

type SummaryPanelProps = {
  aggregate: HabitAggregate;
  weightDelta: WeightDelta | null;
  historyLoading: boolean;
  startDate: string;
};

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  aggregate,
  weightDelta,
  historyLoading,
  startDate,
}) => {
  return (
    <Card className="summary-card">
      <CardHeader>
        <h3>Summary (since {startDate})</h3>
        {historyLoading ? <Chip>Loading…</Chip> : <Chip>Aggregated</Chip>}
      </CardHeader>

      <div className="summary-grid">
        <div className="stat">
          <div className="stat-label">BK</div>
          <div className="stat-value">{aggregate.BK} min</div>
        </div>
        <div className="stat">
          <div className="stat-label">SD</div>
          <div className="stat-value">{aggregate.SD} min</div>
        </div>
        <div className="stat">
          <div className="stat-label">AP</div>
          <div className="stat-value">{aggregate.AP} min</div>
        </div>

        <div className="divider" />

        <div className="stat">
          <div className="stat-label">Total SD</div>
          <div className="stat-value emphasis">{aggregate.totalStudy} min</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Waste</div>
          <div className="stat-value">{aggregate.totalWaste} min</div>
        </div>
        <div
          className={`stat ${aggregate.totalWasteDelta > 0 ? "warn" : "ok"}`}
        >
          <div className="stat-label">Waste Allowance Δ</div>
          <div className="stat-value emphasis">
            {aggregate.totalWasteDelta > 0
              ? `+${aggregate.totalWasteDelta}`
              : aggregate.totalWasteDelta}
          </div>
          <div className="stat-sub">
            Sum of (wasted − {WASTE_LIMIT_MINUTES}) on days with input
          </div>
        </div>

        <div className="divider" />

        <div className="stat weight-trend">
          <div className="stat-label">Weight Trend</div>
          {aggregate.firstWeight === null || aggregate.latestWeight === null ? (
            <div className="stat-value">—</div>
          ) : (
            <>
              <div className="stat-value">
                {aggregate.firstWeight} → {aggregate.latestWeight} lbs
              </div>
              <div className="stat-sub">
                First: {aggregate.firstWeightDate} · Latest: {" "}
                {aggregate.latestWeightDate}
              </div>
              {weightDelta && (
                <div
                  className={`delta-badge ${
                    weightDelta.diff < 0
                      ? "good"
                      : weightDelta.diff > 0
                      ? "bad"
                      : ""
                  }`}
                  style={{ marginTop: 6 }}
                >
                  {weightDelta.diff > 0 ? "+" : ""}
                  {weightDelta.diff.toFixed(1)} lbs
                  {weightDelta.pct !== null ? ` (${weightDelta.pct}%)` : ""}
                </div>
              )}
            </>
          )}
        </div>

        <div className="divider" />

        <div className="stat">
          <div className="stat-label">Avg News / day</div>
          <div className="stat-value">
            {aggregate.avgNewsPerDay.toFixed(2)}
          </div>
          <div className="stat-sub">
            Total: {aggregate.totalNewsAccess} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Avg Music / day</div>
          <div className="stat-value">
            {aggregate.avgMusicPerDay.toFixed(2)}
          </div>
          <div className="stat-sub">
            Total: {aggregate.totalMusicListen} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Avg JL / day</div>
          <div className="stat-value">{aggregate.avgJlPerDay.toFixed(2)}</div>
          <div className="stat-sub">
            Total: {aggregate.totalJl} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="divider" />

        <div className="stat">
          <div className="stat-label">Avg BK / day</div>
          <div className="stat-value">{aggregate.avgBKPerDay.toFixed(2)}</div>
          <div className="stat-sub">
            Total: {aggregate.BK} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Avg SD / day</div>
          <div className="stat-value">{aggregate.avgSDPerDay.toFixed(2)}</div>
          <div className="stat-sub">
            Total: {aggregate.SD} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Avg AP / day</div>
          <div className="stat-value">{aggregate.avgAPPerDay.toFixed(2)}</div>
          <div className="stat-sub">
            Total: {aggregate.AP} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Avg Waste / day</div>
          <div className="stat-value">
            {aggregate.avgWastePerDay.toFixed(2)} min
          </div>
          <div className="stat-sub">
            Total: {aggregate.totalWaste} across {aggregate.daysObserved} day
            {aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Avg Total SD / day</div>
          <div className="stat-value">
            {aggregate.avgTotalStudyPerDay.toFixed(2)} min
          </div>
          <div className="stat-sub">
            (BK + SD + AP) · Total: {aggregate.totalStudy} across {" "}
            {aggregate.daysObserved} day{aggregate.daysObserved === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SummaryPanel;
