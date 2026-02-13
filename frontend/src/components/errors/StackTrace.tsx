import { useMemo } from 'react'

interface StackTraceProps {
  stackTrace: string
}

// Simple syntax highlighting for stack traces
// Highlights: "at", "Error", file paths, line numbers
function highlightLine(line: string, isErrorLine: boolean): React.ReactNode {
  if (isErrorLine) {
    return <span className="text-red-400">{line}</span>
  }

  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  // Match "at " with cyan
  const atMatch = remaining.match(/^(at\s+)/)
  if (atMatch) {
    parts.push(
      <span key={key++} className="text-cyan-400">
        {atMatch[1]}
      </span>
    )
    remaining = remaining.slice(atMatch[0].length)
  }

  // Match "Error" or error type names
  const errorMatch = remaining.match(/^(\w+Error|\w+Exception)\s*:/)
  if (errorMatch) {
    parts.push(
      <span key={key++} className="text-red-400 font-semibold">
        {errorMatch[1]}
      </span>
    )
    remaining = remaining.slice(errorMatch[0].length)
  }

  // Match file paths (e.g., /path/to/file.ts or C:\path\to\file.ts)
  const pathMatch = remaining.match(/^((?:[A-Za-z]:)?[\\/][^\s]+)/)
  if (pathMatch) {
    parts.push(
      <span key={key++} className="text-yellow-300">
        {pathMatch[1]}
      </span>
    )
    remaining = remaining.slice(pathMatch[1].length)
  }

  // Match line numbers (e.g., :42 or :42:15)
  const lineNumMatch = remaining.match(/^(:(\d+)(?::(\d+))?)/)
  if (lineNumMatch) {
    parts.push(
      <span key={key++} className="text-green-400">
        {lineNumMatch[1]}
      </span>
    )
    remaining = remaining.slice(lineNumMatch[0].length)
  }

  // Match method/function names in parentheses
  const methodMatch = remaining.match(/^(\s*\([^)]+\))/)
  if (methodMatch) {
    parts.push(
      <span key={key++} className="text-blue-300">
        {methodMatch[1]}
      </span>
    )
    remaining = remaining.slice(methodMatch[1].length)
  }

  if (remaining) {
    parts.push(
      <span key={key++} className="text-gray-400">
        {remaining}
      </span>
    )
  }

  return <>{parts}</>
}

export default function StackTrace({ stackTrace }: StackTraceProps) {
  const lines = useMemo(() => stackTrace.trim().split('\n'), [stackTrace])

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-900 overflow-hidden">
      <pre className="p-4 font-mono text-sm overflow-x-auto">
        {lines.map((line, idx) => {
          const isErrorLine = line.includes('Error') && line.includes(':') && idx < 2
          return (
            <div
              key={idx}
              className="flex hover:bg-gray-800/50 py-0.5 px-2 -mx-2"
            >
              <span className="flex-shrink-0 w-8 text-right text-gray-500 select-none pr-4">
                {idx + 1}
              </span>
              <span className="flex-1 break-all">
                {highlightLine(line, isErrorLine)}
              </span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
