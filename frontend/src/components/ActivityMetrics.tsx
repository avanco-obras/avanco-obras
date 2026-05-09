interface ActivityMetricsItem {
  name: string;
  planned: number;
  actual: number;
}

interface ActivityMetricsProps {
  items: ActivityMetricsItem[];
}

function getActualBarColor(actual: number, planned: number): string {
  if (planned === 0) return '#94a3b8';
  const ratio = actual / planned;
  if (ratio >= 0.9) return '#22c55e';
  if (ratio >= 0.5) return '#f59e0b';
  return '#ef4444';
}

export function ActivityMetrics({ items }: ActivityMetricsProps) {
  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Sem dados de atividades
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => b.planned - a.planned);

  return (
    <div className="space-y-3">
      {sorted.map((item) => {
        const actualColor = getActualBarColor(item.actual, item.planned);
        const plannedWidth = Math.min(100, Math.max(0, item.planned));
        const actualWidth = Math.min(100, Math.max(0, item.actual));

        return (
          <div key={item.name} className="flex items-center gap-3">
            {/* Name label */}
            <div
              className="shrink-0 text-xs text-muted-foreground text-right leading-tight"
              style={{ width: 110 }}
              title={item.name}
            >
              <span className="block truncate">{item.name}</span>
            </div>

            {/* Bar track */}
            <div className="relative flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
              {/* Planned bar (background blue) */}
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{
                  width: `${plannedWidth}%`,
                  backgroundColor: '#bfdbfe',
                }}
              />
              {/* Actual bar (colored overlay) */}
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{
                  width: `${actualWidth}%`,
                  backgroundColor: actualColor,
                  opacity: 0.8,
                }}
              />
            </div>

            {/* Percentage labels */}
            <div className="shrink-0 flex gap-1.5 text-xs font-medium" style={{ width: 88 }}>
              <span className="text-blue-500">{item.planned.toFixed(0)}%</span>
              <span className="text-muted-foreground">/</span>
              <span style={{ color: actualColor }}>{item.actual.toFixed(0)}%</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-2 rounded" style={{ backgroundColor: '#bfdbfe' }} />
          Planejado
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-2 rounded bg-green-500" />
          Realizado
        </div>
      </div>
    </div>
  );
}
