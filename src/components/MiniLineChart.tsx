'use client';

interface MiniLineChartProps {
  data: number[];
  trend: 'up' | 'down';
  height?: number;
}

export default function MiniLineChart({
  data,
  trend,
  height = 40,
}: MiniLineChartProps) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  // Create SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Create area path for gradient fill
  const areaD = `M 0,100 L ${points.join(' L ')} L 100,100 Z`;

  const strokeColor =
    trend === 'up'
      ? 'rgb(34, 197, 94)' // green-500
      : 'rgb(239, 68, 68)'; // red-500

  const gradientId = `gradient-${trend}-${height}-${Math.random()}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full transition-all duration-500 ease-in-out"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Area fill with animation */}
      <path 
        d={areaD} 
        fill={`url(#${gradientId})`}
        className="transition-all duration-700 ease-in-out"
      />

      {/* Line with animation */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        className="transition-all duration-700 ease-in-out"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
