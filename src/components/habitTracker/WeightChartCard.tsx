import React, { useRef, useState } from "react";
import type { WeightPoint } from "./types";
import { Card, CardHeader, Chip } from "../shared/Card";

type WeightChartCardProps = {
  series: WeightPoint[];
};

type HoverPoint = {
  left: number;
  top: number;
  date: string;
  weight: number;
} | null;

const WeightChartCard: React.FC<WeightChartCardProps> = ({ series }) => {
  const weightSvgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<HoverPoint>(null);

  if (series.length === 0) {
    return (
      <Card className="weight-chart-card">
        <CardHeader>
          <h3>Weight (graph)</h3>
          <Chip>Trend over time</Chip>
        </CardHeader>
        <p>No weight data yet. Add some daily weights to see the graph.</p>
      </Card>
    );
  }

  const width = 600;
  const height = 220;
  const padding = 32;

  const weights = series.map((p) => p.weight);
  let minW = Math.min(...weights);
  let maxW = Math.max(...weights);

  const margin = 0.5;
  minW -= margin;
  maxW += margin;

  if (minW === maxW) {
    minW -= 1;
    maxW += 1;
  }

  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;

  const xForIndex = (i: number) => {
    if (series.length === 1) return width / 2;
    return padding + (i / (series.length - 1)) * innerWidth;
  };

  const yForWeight = (w: number) => {
    const t = (w - minW) / (maxW - minW || 1);
    return padding + (1 - t) * innerHeight;
  };

  const points = series
    .map((p, i) => `${xForIndex(i)},${yForWeight(p.weight)}`)
    .join(" ");

  return (
    <Card className="weight-chart-card">
      <CardHeader>
        <h3>Weight (graph)</h3>
        <Chip>Trend over time</Chip>
      </CardHeader>

      <div className="weight-chart-wrapper">
        <svg
          ref={weightSvgRef}
          className="weight-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverPoint(null)}
        >
          <line
            x1="24"
            y1={height - 24}
            x2={width - 24}
            y2={height - 24}
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <line
            x1="24"
            y1="24"
            x2="24"
            y2={height - 24}
            stroke="#d1d5db"
            strokeWidth="1"
          />

          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={points}
          />

          {series.map((p, i) => (
            <circle
              key={p.date}
              cx={xForIndex(i)}
              cy={yForWeight(p.weight)}
              r="4"
              fill="#1d4ed8"
              onMouseEnter={(e) => {
                const rect = weightSvgRef.current?.getBoundingClientRect();
                if (!rect) return;
                setHoverPoint({
                  left: e.clientX - rect.left,
                  top: e.clientY - rect.top - 12,
                  date: p.date,
                  weight: p.weight,
                });
              }}
              onFocus={() => {}}
            />
          ))}

          <text x="28" y="32" fontSize="10" fill="#6b7280">
            {maxW.toFixed(1)} lbs
          </text>
          <text x="28" y={height - 28} fontSize="10" fill="#6b7280">
            {minW.toFixed(1)} lbs
          </text>

          <text
            x={xForIndex(0)}
            y={height - 10}
            fontSize="9"
            textAnchor="middle"
            fill="#6b7280"
          >
            {series[0].date.slice(5)}
          </text>
          <text
            x={xForIndex(series.length - 1)}
            y={height - 10}
            fontSize="9"
            textAnchor="middle"
            fill="#6b7280"
          >
            {series[series.length - 1].date.slice(5)}
          </text>
        </svg>
        {hoverPoint && (
          <div
            className="weight-tooltip"
            style={{ left: hoverPoint.left, top: hoverPoint.top }}
          >
            <div className="tooltip-date">{hoverPoint.date}</div>
            <div className="tooltip-weight">
              {hoverPoint.weight.toFixed(1)} lbs
            </div>
          </div>
        )}
      </div>

      <div className="weight-chart-footer">
        <span>
          First: {series[0].weight.toFixed(1)} lbs ({series[0].date})
        </span>
        <span>
          Latest: {series[series.length - 1].weight.toFixed(1)} lbs (
          {series[series.length - 1].date})
        </span>
      </div>
    </Card>
  );
};

export default WeightChartCard;
