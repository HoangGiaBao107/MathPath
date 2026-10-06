"use client";

export type LineChartSeries = { label: string; color: string; values: number[]; dashed?: boolean };

export function LineChart({
  labels,
  series,
  pointDetails,
  ariaLabel,
  formatValue = (value) => String(value),
}: {
  labels: string[];
  series: LineChartSeries[];
  pointDetails?: string[][];
  ariaLabel: string;
  formatValue?: (value: number) => string;
}) {
  const width = 760;
  const height = 250;
  const left = 44;
  const right = 16;
  const top = 18;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));
  const x = (index: number) =>
    left + (labels.length <= 1 ? plotWidth / 2 : (index * plotWidth) / (labels.length - 1));
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;
  const tickIndexes = [...new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1])];

  if (labels.length === 0 || series.every((item) => item.values.length === 0)) {
    return <div className="analytics-chart-empty">—</div>;
  }

  return (
    <div className="analytics-chart-wrap">
      <svg
        className="analytics-line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        {[0, 0.5, 1].map((fraction) => {
          const gridY = top + plotHeight * fraction;
          const value = maxValue * (1 - fraction);
          return (
            <g key={fraction}>
              <line
                x1={left}
                x2={width - right}
                y1={gridY}
                y2={gridY}
                className="analytics-chart-grid"
              />
              <text x={left - 8} y={gridY + 4} textAnchor="end" className="analytics-chart-axis">
                {formatValue(value)}
              </text>
            </g>
          );
        })}
        {series.map((item, seriesIndex) => {
          const path = item.values
            .map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`)
            .join(" ");
          return (
            <g key={item.label}>
              <path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeDasharray={item.dashed ? "8 7" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {item.values.map((value, index) => (
                <circle
                  key={`${item.label}-${labels[index]}`}
                  cx={x(index)}
                  cy={y(value)}
                  r="3.5"
                  fill={item.color}
                >
                  <title>{`${item.label} · ${pointDetails?.[seriesIndex]?.[index] ?? labels[index]} · ${formatValue(value)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {tickIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
            className="analytics-chart-axis"
          >
            {labels[index]}
          </text>
        ))}
      </svg>
      <ul className="sr-only">
        {series.flatMap((item, seriesIndex) =>
          item.values.map((value, index) => (
            <li key={`${item.label}-accessible-${index}`}>
              {item.label}: {pointDetails?.[seriesIndex]?.[index] ?? labels[index]},{" "}
              {formatValue(value)}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
