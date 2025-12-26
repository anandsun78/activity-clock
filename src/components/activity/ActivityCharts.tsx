import React, { useState } from "react";
import { colorForActivity, fmtM } from "./utils";
import type { DonutRow, TrendDay, TrendPoint, TrendSeries } from "./types";

type DonutChartProps = { rows: DonutRow[] };

export function DonutChart({ rows }: DonutChartProps) {
  const size = 180;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const filtered = rows.filter((r) => r.pct > 0.2);
  let offset = 0;
  const legendGrid = {
    display: "grid",
    gap: 8,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "start",
    minWidth: 220,
    flex: 1,
  } as const;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          {filtered.map((r) => {
            const len = (r.pct / 100) * circ;
            const dasharray = `${len} ${circ - len}`;
            const dashoffset = circ * offset;
            offset += r.pct / 100;
            return (
              <circle
                key={r.activity}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colorForActivity(r.activity)}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            );
          })}
        </g>
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="14"
          fill="#0f172a"
        >
          Today (%)
        </text>
      </svg>
      <div style={legendGrid}>
        {filtered.map((r) => (
          <div
            key={r.activity}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
            title={`${r.activity} — ${r.pct.toFixed(1)}% • ${Math.round(
              r.minutes
            )}m`}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colorForActivity(r.activity),
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.activity}
              </div>
              <div style={{ fontSize: 12, color: "var(--ac-muted)" }}>
                {r.pct.toFixed(1)}% • {Math.round(r.minutes)}m
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type BarProps = { pct: number };

export function Bar({ pct }: BarProps) {
  return (
    <div
      style={{
        background: "#e2e8f0",
        borderRadius: 8,
        height: 10,
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`,
          height: 10,
          borderRadius: 8,
          background: "linear-gradient(90deg, #a855f7, #22d3ee)",
        }}
      />
    </div>
  );
}

type MultiLinePerDayProps = {
  days: TrendDay[];
  seriesByActivity: TrendSeries;
  selectable: string[];
  selectedSet: Set<string>;
  onToggle: (name: string) => void;
  mode: "m" | "pct";
};

export function MultiLinePerDay({
  days,
  seriesByActivity,
  selectable,
  selectedSet,
  onToggle,
  mode,
}: MultiLinePerDayProps) {
  const pad = { l: 44, r: 12, t: 10, b: 26 };
  const W = 760;
  const H = 240;
  const stepX = days.length > 1 ? (W - pad.l - pad.r) / (days.length - 1) : 0;

  const visibles = selectable.filter((a) => selectedSet.has(a));
  const key = mode === "pct" ? "pct" : "m";

  let maxY;
  if (mode === "pct") {
    const maxSeen = Math.max(
      1,
      ...visibles.flatMap((a) =>
        (seriesByActivity[a] || []).map((p) => p.pct || 0)
      )
    );
    maxY = Math.min(100, Math.max(25, Math.ceil(maxSeen / 10) * 10));
  } else {
    const maxSeen = Math.max(
      1,
      ...visibles.flatMap((a) =>
        (seriesByActivity[a] || []).map((p) => p.m || 0)
      )
    );
    maxY = Math.max(60, Math.ceil(maxSeen / 30) * 30);
  }
  const yToPix = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);

  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - pad.l;
    const i = Math.round(x / stepX);
    if (i >= 0 && i < days.length) setHover({ i, x: pad.l + i * stepX });
  };
  const onLeave = () => setHover(null);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={W}
        height={H}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          background: "#ffffff",
          border: "1px solid var(--ac-border)",
          borderRadius: 12,
        }}
      >
        {days.map((d, i) =>
          d.weekend && stepX > 0 ? (
            <rect
              key={`wk-${i}`}
              x={pad.l + i * stepX - stepX / 2}
              y={pad.t}
              width={stepX}
              height={H - pad.t - pad.b}
              fill="#94a3b8"
              opacity="0.12"
            />
          ) : null
        )}

        <line
          x1={pad.l}
          y1={H - pad.b}
          x2={W - pad.r}
          y2={H - pad.b}
          stroke="rgba(255,255,255,0.16)"
        />
        <line
          x1={pad.l}
          y1={pad.t}
          x2={W - pad.r}
          y2={H - pad.b}
          stroke="rgba(255,255,255,0.16)"
        />

        {[0, 0.25, 0.5, 0.75, 1].map((fr) => {
          const y = yToPix(fr * maxY);
          const label =
            mode === "pct" ? `${Math.round(fr * maxY)}%` : fmtM(fr * maxY);
          return (
            <g key={fr}>
              <line
                x1={pad.l}
                y1={y}
                x2={W - pad.r}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={pad.l - 6}
                y={y}
                textAnchor="end"
                alignmentBaseline="middle"
                fontSize="11"
                fill="#cbd5e1"
              >
                {label}
              </text>
            </g>
          );
        })}

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.date}
              x={pad.l + i * stepX}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#cbd5e1"
            >
              {d.date.slice(5)}
            </text>
          ) : null
        )}

        {visibles.map((name) => {
          const pts = seriesByActivity[name] || [];
          const d = pts
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${pad.l + i * stepX},${yToPix(
                  p[key] || 0
                )}`
            )
            .join(" ");
          const c = colorForActivity(name);
          return (
            <path key={name} d={d} fill="none" stroke={c} strokeWidth="2" />
          );
        })}

        {hover && (
          <>
            <line
              x1={hover.x}
              y1={pad.t}
              x2={hover.x}
              y2={H - pad.b}
              stroke="#9ca3af"
              strokeDasharray="4 4"
            />
            {visibles.map((name) => {
              const pts = seriesByActivity[name] || [];
              const p = pts[hover.i];
              if (!p) return null;
              return (
                <circle
                  key={`dot-${name}`}
                  cx={hover.x}
                  cy={yToPix(p[key] || 0)}
                  r="3"
                  fill={colorForActivity(name)}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              );
            })}
          </>
        )}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {selectable.map((name) => {
          const active = selectedSet.has(name);
          const c = colorForActivity(name);
          return (
            <button
              key={name}
              onClick={() => onToggle(name)}
              style={{
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 10,
                border: `1px solid ${active ? c : "#e5e7eb"}`,
                background: active ? "#ffffff" : "#f8fafc",
                color: "#111827",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              title={active ? "Hide" : "Show"}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: c,
                  opacity: active ? 1 : 0.35,
                }}
              />
              {name}
              {active && (
                <span style={{ fontSize: 11, color: "var(--ac-muted)" }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {hover && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fff",
            display: "inline-block",
            minWidth: 220,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {days[hover.i].date}
          </div>
          {visibles.map((n) => {
            const p = seriesByActivity[n]?.[hover.i];
            const val =
              mode === "pct" ? `${Math.round(p?.pct || 0)}%` : fmtM(p?.m || 0);
            return (
              <div
                key={`t-${n}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: colorForActivity(n),
                    }}
                  />
                  {n}
                </div>
                <div style={{ color: "#374151" }}>{val}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SparklineProps = {
  points: TrendPoint[];
  mode?: "m" | "pct";
  color: string;
  height?: number;
  pad?: number;
};

export function Sparkline({
  points,
  mode = "m",
  color,
  height = 44,
  pad = 4,
}: SparklineProps) {
  const w = 160;
  const h = height;
  const key = mode === "pct" ? "pct" : "m";
  const vals = points.map((p) => p[key]);
  const max = Math.max(1, ...vals);
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const weekendRects = points.map((p, i) =>
    p.weekend ? (
      <rect
        key={`wk-${i}`}
        x={pad + i * stepX - stepX / 2}
        y={pad}
        width={stepX}
        height={h - pad * 2}
        fill="#94a3b8"
        opacity="0.12"
      />
    ) : null
  );
  const linePts = points
    .map(
      (p, i) =>
        `${pad + i * stepX},${pad + (1 - p[key] / max) * (h - pad * 2)}`
    )
    .join(" ");
  const last = points[points.length - 1];
  const lastVal = last ? last[key] : 0;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect x="0" y="0" width={w} height={h} fill="#ffffff" rx="8" />
      {weekendRects}
      <polyline fill="none" stroke={color} strokeWidth="2" points={linePts} />
      {points.length > 0 && (
        <circle
          cx={pad + (points.length - 1) * stepX}
          cy={pad + (1 - lastVal / max) * (h - pad * 2)}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}

type ActivityCardMiniProps = {
  name: string;
  series: TrendSeries;
  mode: "m" | "pct";
  onFocus: (name: string) => void;
  focused: boolean;
};

export function ActivityCardMini({
  name,
  series,
  mode,
  onFocus,
  focused,
}: ActivityCardMiniProps) {
  const color = colorForActivity(name);
  const v = series[name] || [];
  const last = v[v.length - 1];
  const metric =
    mode === "pct" ? `${(last?.pct ?? 0).toFixed(0)}%` : fmtM(last?.m ?? 0);
  return (
    <div
      onClick={() => onFocus(name)}
      style={{
        border: `1px solid ${focused ? color : "var(--ac-border)"}`,
        background: "#ffffff",
        borderRadius: 12,
        padding: 10,
        cursor: "pointer",
        boxShadow: focused
          ? "0 6px 14px rgba(0,0,0,0.24)"
          : "0 4px 10px rgba(0,0,0,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{ width: 10, height: 10, borderRadius: 2, background: color }}
        />
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ac-muted)" }}>{metric}</div>
      </div>
      <Sparkline points={v} mode={mode} color={color} />
      <div style={{ fontSize: 11, color: "var(--ac-muted)", marginTop: 6 }}>
        {mode === "pct"
          ? "Last days (% of day). Shaded = weekend."
          : "Last days (minutes). Shaded = weekend."}
      </div>
    </div>
  );
}
