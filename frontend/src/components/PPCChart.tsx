import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface PPCChartProps {
  data: Array<{ weekLabel: string; ppcActual: number; ppcTarget: number }>;
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function getBarColor(value: number): string {
  if (value >= 80) return '#22c55e';
  if (value >= 70) return '#f59e0b';
  return '#ef4444';
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: getBarColor(value) }}
        />
        <span className="text-muted-foreground">PPC:</span>
        <span className="font-medium text-foreground">{value.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function PPCChart({ data, height = 200 }: PPCChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        Sem histórico de PPC
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 10, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
        <ReferenceLine
          y={80}
          stroke="#3b82f6"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{ value: 'Meta 80%', position: 'insideTopRight', fontSize: 10, fill: '#3b82f6' }}
        />
        <Bar dataKey="ppcActual" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(entry.ppcActual)}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
