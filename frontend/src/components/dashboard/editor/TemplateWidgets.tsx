import { Zap } from 'lucide-react'
import { type WidgetConfig } from './WidgetConfigPanel'
import { type WidgetType } from './WidgetTypePicker'

interface Template {
  label: string
  type: WidgetType
  title: string
  query: string
  size: '1/3' | '1/2' | '2/3' | 'full'
}

const templates: Template[] = [
  {
    label: 'Error Rate by Service',
    type: 'bar',
    title: 'Error Rate by Service',
    query: 'metric:http.request.error_rate | group:service',
    size: '1/2',
  },
  {
    label: 'Request Latency P99',
    type: 'line',
    title: 'Request Latency P99',
    query: 'metric:http.request.duration | agg:p99',
    size: '1/2',
  },
  {
    label: 'Active Incidents',
    type: 'billboard',
    title: 'Active Incidents',
    query: 'metric:incidents.active | agg:count',
    size: '1/3',
  },
  {
    label: 'Throughput Over Time',
    type: 'area',
    title: 'Request Throughput',
    query: 'metric:http.request.count | agg:rate',
    size: '1/2',
  },
  {
    label: 'Severity Distribution',
    type: 'pie',
    title: 'Incident Severity',
    query: 'metric:incidents | group:severity',
    size: '1/3',
  },
  {
    label: 'Top Errors Table',
    type: 'table',
    title: 'Top Errors',
    query: 'metric:errors | group:message | sort:count desc | limit:10',
    size: '2/3',
  },
]

interface TemplateWidgetsProps {
  onAdd: (widget: Omit<WidgetConfig, 'id'>) => void
}

export default function TemplateWidgets({ onAdd }: TemplateWidgetsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-gray-800">Quick Templates</h3>
      </div>
      <div className="space-y-1.5">
        {templates.map((t, i) => (
          <button
            key={i}
            onClick={() => onAdd({ type: t.type, title: t.title, query: t.query, size: t.size })}
            className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:bg-blue-500 flex-shrink-0" />
            <span className="text-xs text-gray-700 group-hover:text-gray-900 truncate">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
