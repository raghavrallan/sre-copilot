import { useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { GripVertical, Settings, Trash2, Loader2 } from 'lucide-react'
import { type WidgetConfig, type WidgetSize } from './WidgetConfigPanel'

interface WidgetCardProps {
  widget: WidgetConfig
  liveData?: any[] | null
  liveLoading?: boolean
  onEdit: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

const PLACEHOLDER_DATA = [
  { name: 'A', value: 400 },
  { name: 'B', value: 300 },
  { name: 'C', value: 200 },
  { name: 'D', value: 278 },
  { name: 'E', value: 189 },
]

const LINE_DATA = [
  { time: '10:00', v: 45 },
  { time: '10:15', v: 52 },
  { time: '10:30', v: 48 },
  { time: '10:45', v: 55 },
  { time: '11:00', v: 62 },
  { time: '11:15', v: 58 },
]

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export const sizeToClass: Record<WidgetSize, string> = {
  '1/3': 'col-span-1',
  '1/2': 'col-span-1 md:col-span-2',
  '2/3': 'col-span-1 md:col-span-2 lg:col-span-3',
  'full': 'col-span-1 md:col-span-2 lg:col-span-4',
}

function renderChart(type: string, data?: any[] | null) {
  const chartData = data && data.length > 0 ? data : (type === 'pie' || type === 'bar' ? PLACEHOLDER_DATA : LINE_DATA)
  const isPlaceholder = !data || data.length === 0

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={chartData === LINE_DATA ? 'time' : 'name'} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey={chartData === LINE_DATA ? 'v' : 'value'} stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey={chartData === LINE_DATA ? 'time' : 'name'} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey={chartData === LINE_DATA ? 'v' : 'value'} stroke="#10b981" fill="url(#areaGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
              {chartData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )
    case 'billboard':
      return (
        <div className="flex flex-col items-center justify-center h-[160px]">
          <span className="text-4xl font-bold text-gray-900">{isPlaceholder ? '—' : chartData[0]?.value ?? '—'}</span>
          {isPlaceholder && <span className="text-xs text-gray-400 mt-1">Configure a query to show data</span>}
        </div>
      )
    case 'table':
      return (
        <div className="overflow-auto max-h-[160px] text-sm">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100">
                <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500">Name</th>
                <th className="text-right py-1.5 px-2 text-xs font-medium text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((r: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 text-gray-700">{r.name || r.time || `Row ${i}`}</td>
                  <td className="py-1.5 px-2 text-right text-gray-900 tabular-nums">{r.value || r.v || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return <div className="text-gray-400 text-sm text-center py-8">Unknown widget type</div>
  }
}

export default function WidgetCard({ widget, liveData, liveLoading, onEdit, onDelete, onDragStart, onDragOver, onDrop }: WidgetCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e) }}
      className={`${sizeToClass[widget.size]} bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
        isDragOver ? 'border-blue-400 shadow-blue-100 scale-[1.01]' : 'border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800 truncate">{widget.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono flex-shrink-0">
            {widget.type}
          </span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4">
        {liveLoading ? (
          <div className="flex items-center justify-center h-[160px]">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          renderChart(widget.type, liveData)
        )}
      </div>
    </div>
  )
}
