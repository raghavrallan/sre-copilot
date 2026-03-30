interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizeMap = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 40, text: 'text-2xl' },
  xl: { icon: 56, text: 'text-4xl' },
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const { icon, text } = sizeMap[size]

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="logoShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="logoPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <filter id="logoGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M32 3 L57 16 L57 35 Q57 53 32 61 Q7 53 7 35 L7 16 Z"
          fill="url(#logoShieldGrad)"
          stroke="#1E40AF"
          strokeWidth="1.5"
        />
        <path
          d="M32 7 L54 18.5 L54 35 Q54 50.5 32 57.5 Q10 50.5 10 35 L10 18.5 Z"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
        <polyline
          points="12,36 22,36 26,24 30,44 34,20 38,40 42,32 46,36 52,36"
          fill="none"
          stroke="url(#logoPulseGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#logoGlow)"
        />
        <circle cx="52" cy="36" r="2.5" fill="#93C5FD" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${text} font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent`}>
            SRE Copilot
          </span>
        </div>
      )}
    </div>
  )
}
