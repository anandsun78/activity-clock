import React, { useMemo, useState } from "react";
import { yyyyMmDdEdmonton } from "../dateUtils";
import { useVacationDays } from "../vacationDays";

export default function VacationDaysPanel() {
  const [days, setDays] = useVacationDays();
  const [input, setInput] = useState<string>("");
  const today = yyyyMmDdEdmonton();

  const sortedDays = useMemo(() => [...days].sort(), [days]);

  const addDay = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (days.includes(trimmed)) {
      setInput("");
      return;
    }
    setDays([...days, trimmed]);
    setInput("");
  };

  const removeDay = (value: string) => {
    setDays(days.filter((d) => d !== value));
  };

  return (
    <section className="card vacation-card">
      <div className="card-header">
        <h3>Vacation Days</h3>
        <div className="chip">Excluded from streaks + analytics</div>
      </div>

      <div className="vacation-controls">
        <input
          type="date"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addDay(input);
          }}
        />
        <button className="chip" onClick={() => addDay(input)}>
          Add
        </button>
        <button
          className="chip"
          onClick={() => addDay(today)}
          disabled={days.includes(today)}
          title={days.includes(today) ? "Already added" : "Add today"}
        >
          Add today
        </button>
        {days.length > 0 && (
          <button className="chip" onClick={() => setDays([])}>
            Clear all
          </button>
        )}
      </div>

      {sortedDays.length === 0 ? (
        <div className="vacation-empty">No vacation days yet.</div>
      ) : (
        <div className="vacation-list">
          {sortedDays.map((day) => (
            <div key={day} className="vacation-pill">
              <span>{day}</span>
              <button
                type="button"
                aria-label={`Remove ${day}`}
                onClick={() => removeDay(day)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
