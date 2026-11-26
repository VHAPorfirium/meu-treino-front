'use client';

// Gráficos inline, sem dependências. Adaptados automaticamente ao tema claro/escuro.

export function BarChart({
  data,
  color = '#EE4E22',
  height = 150,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted2">Sem dados.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const pct = Math.max(0, Math.min(100, (d.value / max) * 100));
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-extrabold text-muted">{d.value}</span>
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-[36px] rounded-t-md"
                style={{
                  height: `${pct}%`,
                  minHeight: d.value > 0 ? 4 : 2,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="max-w-full truncate text-[10px] font-bold text-muted2">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({
  points,
  color = 'rgb(var(--color-ink))',
  height = 160,
}: {
  points: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (points.length === 0)
    return <p className="py-8 text-center text-sm text-muted2">Sem dados.</p>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const viewWidth = 400;
  const padX = 24;
  const plotW = viewWidth - padX * 2;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? padX + i * stepX : viewWidth / 2;
    const y = height - 20 - ((p.value - min) / range) * (height - 46);
    return { x, y, ...p };
  });
  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
    .join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 ${viewWidth} ${height}`}
        className="w-full overflow-visible"
        style={{ height }}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4" fill="#EE4E22" />
            <text
              x={c.x}
              y={c.y - 9}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill="rgb(var(--color-muted))"
            >
              {c.value}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] font-bold text-muted2">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
