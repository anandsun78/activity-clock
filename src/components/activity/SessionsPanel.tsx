import React from "react";
import { diffMinutes, formatEdmontonTime } from "../../dateUtils";
import { colorForActivity, fmtM } from "./utils";
import "../ActivityClock.css";

type SessionItem = {
  start: string;
  end: string;
  activity: string;
  gapMin?: number;
};

type SessionsPanelProps = {
  title?: string;
  filteredSessions: SessionItem[];
  sessionsSorted: SessionItem[];
  mergeAdjacent: boolean;
  showGaps: boolean;
  activityFilter: string;
  setMergeAdjacent: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGaps: React.Dispatch<React.SetStateAction<boolean>>;
  setActivityFilter: (name: string) => void;
  activitiesToday: string[];
  totalTodayMins: number;
};

const SessionsPanel: React.FC<SessionsPanelProps> = ({
  title = "Today's Sessions",
  filteredSessions,
  sessionsSorted,
  mergeAdjacent,
  showGaps,
  activityFilter,
  setMergeAdjacent,
  setShowGaps,
  setActivityFilter,
  activitiesToday,
  totalTodayMins,
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <span className="chip">
          {(sessionsSorted || []).length} entries • {fmtM(totalTodayMins)} total
        </span>
      </div>

      <div className="ac-toolbar">
        <button
          className={`ac-toggle ${mergeAdjacent ? "is-active" : ""}`}
          onClick={() => setMergeAdjacent((v) => !v)}
          title="Merge adjacent identical activities"
        >
          {mergeAdjacent ? "✓ Merge duplicates" : "Merge duplicates"}
        </button>
        <button
          className={`ac-toggle ${showGaps ? "is-active" : ""}`}
          onClick={() => setShowGaps((v) => !v)}
          title="Show gaps between sessions ≥5m"
        >
          {showGaps ? "✓ Show gaps" : "Show gaps"}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            className={`ac-toggle ${activityFilter === "All" ? "is-active" : ""}`}
            onClick={() => setActivityFilter("All")}
            title="Show all activities"
          >
            All
          </button>
          {activitiesToday.map((a) => (
            <button
              key={a}
              className={`ac-toggle ${activityFilter === a ? "is-active" : ""}`}
              style={{
                borderColor:
                  activityFilter === a ? colorForActivity(a) : "var(--ac-border)",
              }}
              onClick={() => setActivityFilter(a)}
              title={`Filter to ${a}`}
            >
              <span
                className="ac-session-dot"
                style={{ background: colorForActivity(a) }}
              />
              {a}
            </button>
          ))}
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div style={{ fontSize: 15, fontWeight: 500 }} className="ac-muted">
          No sessions match your filters. Try turning off the filter or logging a
          session.
        </div>
      ) : (
        <div className="ac-session-grid">
          {filteredSessions.map((s, i) => {
            const isGap = s.activity === "__GAP__";
            const dur = isGap
              ? fmtM(s.gapMin)
              : fmtM(diffMinutes(s.start, s.end));
            const actColor = isGap ? "#ef4444" : colorForActivity(s.activity);

            return (
              <div
                key={`${s.activity}-${i}`}
                className={`ac-session-card ${isGap ? "gap" : ""}`}
              >
                <div className="ac-session-head">
                  <span className={`ac-session-activity ${isGap ? "gap" : ""}`}>
                    <span
                      className="ac-session-dot"
                      style={{ background: actColor }}
                    />
                    {isGap ? "Gap (Untracked)" : s.activity}
                  </span>
                  <span className="ac-session-duration">{dur}</span>
                </div>
                <div className="ac-session-body">
                  <div className="ac-session-time">
                    {formatEdmontonTime(s.start)} — {formatEdmontonTime(s.end)}
                  </div>
                  {isGap && (
                    <div className="ac-muted">No activity logged between these times.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SessionsPanel;
