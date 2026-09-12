'use client';

// Gráficos SVG inline, sem dependências. Paleta Ritmo (laranja/tinta sobre papel).

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
  const barW = 100 / data.length;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height }}
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 26);
          const x = i * barW + barW * 0.18;
          const w = barW * 0.64;
          return (
            <g key={i}>
              <rect
                x={x}
                y={height - 22 - h}
                width={w}
                height={Math.max(h, 1)}
                rx={2}
                fill={color}
              />
              <text
                x={x + w / 2}
                y={height - 22 - h - 3}
                textAnchor="middle"
                fontSize="6"
                fontWeight="800"
                fill="#5E5348"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex" style={{ marginTop: -18 }}>
        {data.map((d, i) => (
          <span
            key={i}
            className="text-center text-[10px] font-bold text-muted2"
            style={{ width: `${barW}%` }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  points,
  color = '#191512',
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
  const stepX = points.length > 1 ? 100 / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * stepX : 50;
    const y = height - 24 - ((p.value - min) / range) * (height - 40);
    return { x, y, ...p };
  });
  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="1.8" fill="#EE4E22" />
            <text
              x={c.x}
              y={c.y - 4}
              textAnchor="middle"
              fontSize="5.5"
              fontWeight="800"
              fill="#5E5348"
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
