import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import type { CurvaSPoint } from '@/types';
import { formatDate } from '@/utils/calculations';

interface CurvaSProps {
  data: Array<{ label: string; planned: number; actual: number; date: string }>;
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// Only render a label every 2 data points
function conditionalLabel(props: {
  index?: number;
  value?: number;
  x?: number;
  y?: number;
}) {
  const { index = 0, value, x = 0, y = 0 } = props;
  if (index % 2 !== 0 || value === undefined) return null;
  return (
    <text x={x} y={y - 6} textAnchor="middle" fontSize={10} fill="#64748b">
      {value.toFixed(0)}%
    </text>
  );
}

export function CurvaS({ data, height = 320 }: CurvaSProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  // Determine today's label for the reference line
  const today = new Date();
  const todayLabel = `${today.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(today.getFullYear()).slice(2)}`;
  const todayInRange = data.some((d) => d.label === todayLabel);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          iconType="line"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />

        {todayInRange && (
          <ReferenceLine
            x={todayLabel}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: '#ef4444' }}
          />
        )}

        <Line
          type="monotone"
          dataKey="planned"
          name="Planejado"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 4 }}
        >
          <LabelList content={conditionalLabel as never} />
        </Line>

        <Line
          type="monotone"
          dataKey="actual"
          name="Realizado"
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        >
          <LabelList content={conditionalLabel as never} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}
