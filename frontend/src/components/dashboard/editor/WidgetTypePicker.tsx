import { BarChart3, LineChart, AreaChart, PieChart, Table, Hash } from 'lucide-react'

export type WidgetType = 'line' | 'area' | 'bar' | 'pie' | 'table' | 'billboard'

interface WidgetTypePickerProps {
  onSelect: (type: WidgetType) => void
  onClose: () => void
}

const widgetTypes: { type: WidgetType; label: string; icon: typeof LineChart; description: string }[] = [
  { type: 'line', label: 'Line Chart', icon: LineChart, description: 'Time series trends' },
  { type: 'area', label: 'Area Chart', icon: AreaChart, description: 'Filled trend areas' },
  { type: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Compare categories' },
  { type: 'pie', label: 'Pie Chart', icon: PieChart, description: 'Distribution breakdown' },
  { type: 'billboard', label: 'Billboard', icon: Hash, description: 'Single big number' },
  { type: 'table', label: 'Table', icon: Table, description: 'Tabular data view' },
]

export default function WidgetTypePicker({ onSelect, onClose }: WidgetTypePickerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Add Widget</h3>
        <p className="text-sm text-gray-500 mb-4">Choose a visualization type</p>

        <div className="grid grid-cols-2 gap-3">
          {widgetTypes.map(wt => (
            <button
              key={wt.type}
              onClick={() => onSelect(wt.type)}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                <wt.icon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{wt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{wt.description}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
