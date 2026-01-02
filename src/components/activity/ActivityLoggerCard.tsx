import React from "react";
import { formatLocalDateTime } from "../../dateUtils";
import { fmtM } from "./utils";
import { Card, CardHeader, Chip } from "../shared/Card";

type ActivityLoggerCardProps = {
  now: Date;
  start: Date;
  elapsedMins: number;
  nameInput: string;
  minutesInput: string;
  names: string[];
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
  nameInput,
  minutesInput,
  names,
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
          <strong>Elapsed since start:</strong> {fmtM(elapsedMins)}
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
            style={{ cursor: "pointer" }}
          >
            Log segment
          </button>
          <button
            onClick={onUndo}
            className="chip"
            disabled={!canUndo}
            style={{
              cursor: canUndo ? "pointer" : "not-allowed",
              opacity: canUndo ? 1 : 0.5,
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
                  style={{ cursor: "pointer" }}
                  onClick={() => onLog(n, parsedMinutes)}
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
