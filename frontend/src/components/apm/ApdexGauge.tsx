interface ApdexGaugeProps {
  score: number
  size?: number
}

export default function ApdexGauge({ score, size = 120 }: ApdexGaugeProps) {
  const radius = (size - 40) / 2
  const circumference = 2 * Math.PI * radius
  const strokeWidth = 12
  const strokeDasharray = circumference
  const progress = Math.min(1, Math.max(0, score))
  const strokeDashoffset = circumference - progress * circumference

  const getColor = () => {
    if (score > 0.9) return '#22c55e'
    if (score > 0.75) return '#eab308'
    return '#ef4444'
  }

  const color = getColor()

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white" style={{ fontSize: size * 0.2 }}>
          {score.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
