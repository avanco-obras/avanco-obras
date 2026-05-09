import { useMemo } from 'react';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  formatter?: (v: number) => string;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  color = '#3b82f6',
  label,
  sublabel,
  formatter,
}: ProgressRingProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const { radius, circumference, dashOffset, cx, cy } = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (clampedValue / 100) * circumference;
    return { radius, circumference, dashOffset, cx, cy };
  }, [size, strokeWidth, clampedValue]);

  const displayText = formatter
    ? formatter(clampedValue)
    : `${clampedValue.toFixed(1)}%`;

  const fontSize = size < 80 ? size * 0.18 : size * 0.16;
  const trackColor = '#e2e8f0';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label ?? 'Progress'}
      >
        {/* Track circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
          }}
        />
        {/* Center text */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill="currentColor"
          className="text-foreground"
        >
          {displayText}
        </text>
      </svg>

      {label && (
        <span className="text-sm font-semibold text-muted-foreground text-center leading-tight">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-xs text-muted-foreground text-center leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  );
}
