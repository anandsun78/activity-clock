import React from "react";
import type { HabitData, HabitHistoryMap } from "./types";
import { LESS_WASTE_HABIT_LABEL } from "./constants";
import { getHabitStreak } from "./utils";

type HabitListProps = {
  habits: string[];
  habitData: HabitData;
  mergedHistory: HabitHistoryMap;
  onToggle: (habit: string) => void;
};

const HabitList: React.FC<HabitListProps> = ({
  habits,
  habitData,
  mergedHistory,
  onToggle,
}) => {
  return (
    <ul className="habit-list">
      {habits.map((habit) => {
        const done = habitData[habit] || false;
        const streak = getHabitStreak(habit, mergedHistory);
        const isComputed = habit === LESS_WASTE_HABIT_LABEL;
        return (
          <li key={habit} className={`habit-card ${done ? "done" : ""}`}>
            <label className="habit-label">
              <input
                type="checkbox"
                checked={done}
                onChange={() => onToggle(habit)}
                disabled={isComputed}
                title={isComputed ? "Auto-set from wasted minutes" : ""}
              />
              {habit}
              {isComputed && <span className="auto-badge">auto</span>}
            </label>
            <span className={`streak ${streak > 0 ? "active" : ""}`}>
              🔥 {streak}d
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default HabitList;
