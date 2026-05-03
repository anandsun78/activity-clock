import React from "react";
import { formatLocalDateTime, yyyyMmDdLocal } from "../../dateUtils";
import { fmtM } from "./utils";
import { Card, CardHeader, Chip } from "../shared/Card";

type ActivityLoggerCardProps = {
  now: Date;
  start: Date;
  elapsedMins: number;
  elapsedLabel?: string;
  startDateInput: string;
  startDateError?: string;
  nameInput: string;
  minutesInput: string;
  names: string[];
  isBusy?: boolean;
  onStartDateChange: (value: string) => void;
  onApplyStartDate: () => void;
  onNameChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onLog: (activityName?: string, explicitMinutes?: number) => void;
  onUndo: () => void;
  canUndo: boolean;
};

export default function ActivityLoggerCard({
  now,
  start,
  elapsedMins,
  elapsedLabel,
  startDateInput,
  startDateError,
  nameInput,
  minutesInput,
  names,
  isBusy = false,
  onStartDateChange,
  onApplyStartDate,
  onNameChange,
  onMinutesChange,
  onLog,
  onUndo,
  canUndo,
}: ActivityLoggerCardProps) {
  const parsedMinutes = minutesInput ? Number(minutesInput) : undefined;

  return (
    <Card>
      <CardHeader>
        <h3>Now</h3>
        <Chip>{formatLocalDateTime(now)}</Chip>
      </CardHeader>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <strong>Start:</strong> {formatLocalDateTime(start)}
        </div>
        <div>
          <strong>Elapsed since start:</strong>{" "}
          {elapsedLabel || fmtM(elapsedMins)}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <strong>History start date:</strong>
          <div className="metric-input with-unit" style={{ gap: 8 }}>
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => onStartDateChange(e.target.value)}
              max={yyyyMmDdLocal()}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--ac-border)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
            <button
              onClick={onApplyStartDate}
              className="chip"
              disabled={isBusy}
              style={{
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              Apply start date
            </button>
          </div>
          {startDateError && (
            <div style={{ fontSize: 12, color: "#ef4444" }}>{startDateError}</div>
          )}
        </div>

        <div className="metric-input with-unit" style={{ gap: 8 }}>
          <input
            type="text"
            placeholder='What did you do? e.g., "Gym", "Sleep"'
            value={nameInput}
            onChange={(e) => onNameChange(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--ac-border)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          />
          <input
            type="number"
            min="1"
            placeholder="Minutes (optional)"
            value={minutesInput}
            onChange={(e) => onMinutesChange(e.target.value)}
            style={{
              width: 130,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--ac-border)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          />
          <button
            onClick={() => onLog(undefined, parsedMinutes)}
            className="chip"
            disabled={isBusy}
            style={{
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            Log segment
          </button>
          <button
            onClick={onUndo}
            className="chip"
            disabled={!canUndo || isBusy}
            style={{
              cursor: !canUndo || isBusy ? "not-allowed" : "pointer",
              opacity: !canUndo || isBusy ? 0.5 : 1,
            }}
          >
            Undo last
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--ac-muted)" }}>
          Leave minutes empty to log from <b>Start → now</b>. Set minutes to log
          just that many minutes <b>from Start</b> (e.g. 50m work, then 10m
          break). <b>Undo last</b> removes the last logged chunk from the DB and
          restores the previous Start.
        </div>

        {names.length > 0 && (
          <div>
            <div
              style={{ fontSize: 12, color: "var(--ac-muted)", marginBottom: 6 }}
            >
              Quick pick
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {names.map((n) => (
                <button
                  key={n}
                  className="chip"
                  style={{
                    cursor: isBusy ? "not-allowed" : "pointer",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                  onClick={() => onLog(n, parsedMinutes)}
                  disabled={isBusy}
                  title={
                    minutesInput
                      ? `Log ${minutesInput}m of "${n}" from Start`
                      : `Log "${n}" from Start to now`
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
