import { useState } from 'react'
import { X } from 'lucide-react'
import { type WidgetType } from './WidgetTypePicker'

export type WidgetSize = '1/3' | '1/2' | '2/3' | 'full'

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  query: string
  size: WidgetSize
}

interface WidgetConfigPanelProps {
  widget: WidgetConfig
  onSave: (widget: WidgetConfig) => void
  onClose: () => void
}

const sizeOptions: { value: WidgetSize; label: string }[] = [
  { value: '1/3', label: '1/3 Width' },
  { value: '1/2', label: '1/2 Width' },
  { value: '2/3', label: '2/3 Width' },
  { value: 'full', label: 'Full Width' },
]

const typeOptions: { value: WidgetType; label: string }[] = [
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'billboard', label: 'Billboard' },
  { value: 'table', label: 'Table' },
]

export default function WidgetConfigPanel({ widget, onSave, onClose }: WidgetConfigPanelProps) {
  const [config, setConfig] = useState<WidgetConfig>({ ...widget })

  const handleSave = () => {
    onSave(config)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Configure Widget</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={config.title}
              onChange={(e) => setConfig(c => ({ ...c, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Widget title"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig(c => ({ ...c, type: opt.value }))}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    config.type === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
            <div className="grid grid-cols-4 gap-2">
              {sizeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig(c => ({ ...c, size: opt.value }))}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    config.size === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Query */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metric Query</label>
            <textarea
              value={config.query}
              onChange={(e) => setConfig(c => ({ ...c, query: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="metric:http.request.duration | service:api-gateway"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use SRE-QL syntax: metric:name | filter:value | agg:function
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save Widget
          </button>
        </div>
      </div>
    </div>
  )
}
