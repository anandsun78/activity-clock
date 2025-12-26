import React from "react";
import type { HabitData } from "./types";
import { isFiniteNum } from "./utils";
import { Card, CardHeader, Chip } from "../shared/Card";

type DailyMetricsProps = {
  habitData: HabitData;
  getStudyVal: (key: string) => number;
  updateNumber: (key: string, value: string) => void;
  updateStudy: (key: string, value: string) => void;
  minsSinceAny: number | null;
  minsSinceNews: number | null;
  minsSinceMusic: number | null;
  minsSinceJl: number | null;
  totalStudyMin: number;
  hasWastedToday: boolean;
  wastedMin: number;
  wasteDelta: number;
  overWasteLimit: boolean;
};

const DailyMetrics: React.FC<DailyMetricsProps> = ({
  habitData,
  getStudyVal,
  updateNumber,
  updateStudy,
  minsSinceAny,
  minsSinceNews,
  minsSinceMusic,
  minsSinceJl,
  totalStudyMin,
  hasWastedToday,
  wastedMin,
  wasteDelta,
  overWasteLimit,
}) => {
  return (
    <Card className="metrics-card">
      <CardHeader>
        <h3>Daily Metrics</h3>
        <Chip>Tracked per day</Chip>
        <Chip>
          ⏱ Since any: {minsSinceAny === null ? "—" : `${minsSinceAny}m`}
        </Chip>
      </CardHeader>

      <div className="metrics-grid">
        <div className="metric">
          <label>Weight</label>
          <div className="metric-input with-unit">
            <input
              type="number"
              step="0.1"
              value={habitData.weight ?? ""}
              placeholder="e.g., 175.2"
              onChange={(e) => updateNumber("weight", e.target.value)}
            />
            <span className="unit">lbs</span>
          </div>
        </div>

        <div className={`metric ${overWasteLimit ? "warn" : ""}`}>
          <label>Wasted (min)</label>
          <input
            type="number"
            min="0"
            value={hasWastedToday ? habitData.wastedMin : ""}
            placeholder="0"
            onChange={(e) => updateNumber("wastedMin", e.target.value)}
          />
          <small className="hint">
            {overWasteLimit ? "Over 50m limit" : "≤ 50m target"}
          </small>
        </div>

        <div className="metric">
          <label>BK (min)</label>
          <input
            type="number"
            min="0"
            value={getStudyVal("BK")}
            placeholder="0"
            onChange={(e) => updateStudy("BK", e.target.value)}
          />
        </div>

        <div className="metric">
          <label>SD (min)</label>
          <input
            type="number"
            min="0"
            value={getStudyVal("SD")}
            placeholder="0"
            onChange={(e) => updateStudy("SD", e.target.value)}
          />
        </div>

        <div className="metric">
          <label>AP (min)</label>
          <input
            type="number"
            min="0"
            value={getStudyVal("AP")}
            placeholder="0"
            onChange={(e) => updateStudy("AP", e.target.value)}
          />
        </div>

        <div className="metric">
          <label># News Accesses</label>
          <input
            type="number"
            min="0"
            value={
              isFiniteNum(habitData.newsAccessCount)
                ? habitData.newsAccessCount
                : ""
            }
            placeholder="0"
            onChange={(e) => updateNumber("newsAccessCount", e.target.value)}
          />
          <small className="hint">
            Last: {minsSinceNews === null ? "—" : `${minsSinceNews}m ago`}
          </small>
        </div>

        <div className="metric">
          <label># Music Listens</label>
          <input
            type="number"
            min="0"
            value={
              isFiniteNum(habitData.musicListenCount)
                ? habitData.musicListenCount
                : ""
            }
            placeholder="0"
            onChange={(e) => updateNumber("musicListenCount", e.target.value)}
          />
          <small className="hint">
            Last: {minsSinceMusic === null ? "—" : `${minsSinceMusic}m ago`}
          </small>
        </div>

        <div className="metric">
          <label># JL</label>
          <input
            type="number"
            min="0"
            value={isFiniteNum(habitData.jlCount) ? habitData.jlCount : ""}
            placeholder="0"
            onChange={(e) => updateNumber("jlCount", e.target.value)}
          />
          <small className="hint">
            Last: {minsSinceJl === null ? "—" : `${minsSinceJl}m ago`}
          </small>
        </div>
      </div>

      <div className="totals">
        <div className="total">
          <strong>Total SD:</strong> {totalStudyMin} min
        </div>
        <div className={`total ${overWasteLimit ? "warn" : "ok"}`}>
          <strong>Waste:</strong> {wastedMin} min
          {hasWastedToday && (
            <span
              className={`delta-badge ${
                wasteDelta > 0 ? "bad" : wasteDelta < 0 ? "good" : ""
              }`}
            >
              {wasteDelta > 0 ? `+${wasteDelta}` : wasteDelta}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default DailyMetrics;
