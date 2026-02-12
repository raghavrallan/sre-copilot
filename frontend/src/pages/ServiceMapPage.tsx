import { useState, useEffect, useMemo } from 'react'
import { GitBranch } from 'lucide-react'
import api from '../services/api'

interface NodeData {
  id: string
  name: string
  status: 'healthy' | 'warning' | 'critical'
  reqPerMin: number
  throughput?: number
  errorRate?: number
  latency?: number
  x: number
  y: number
}

interface EdgeData {
  source: string
  target: string
  volume?: number
}

interface DependencyMapResponse {
  nodes: string[]
  edges: EdgeData[]
  dependency_map?: Record<string, string[]>
}

interface ServiceOverview {
  name: string
  throughput: number
  avgResponseTime: number
  errorRate: number
}

function circularLayout(nodes: string[], size: number): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>()
  const n = nodes.length
  const center = size / 2
  const radius = size * 0.4
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    map.set(node, {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    })
  })
  return map
}

export default function ServiceMapPage() {
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [dependencyMap, setDependencyMap] = useState<DependencyMapResponse | null>(null)
  const [servicesOverview, setServicesOverview] = useState<ServiceOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerSize = 700

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.get<DependencyMapResponse>('/api/v1/traces/services/dependency-map'),
      api.get<ServiceOverview[]>('/api/v1/metrics/services-overview').catch(() => ({ data: [] })),
    ])
      .then(([depRes, overRes]) => {
        if (!cancelled) {
          setDependencyMap(depRes.data)
          setServicesOverview(overRes.data ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? err.message ?? 'Failed to load service map')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const { nodes, edges } = useMemo(() => {
    const dep = dependencyMap
    if (!dep?.nodes?.length) return { nodes: [] as NodeData[], edges: dep?.edges ?? [] }

    const positions = circularLayout(dep.nodes, 100)
    const overviewByKey = Object.fromEntries(
      (servicesOverview ?? []).map((s) => [s.name, s])
    )

    const nodeList: NodeData[] = dep.nodes.map((n) => {
      const pos = positions.get(n) ?? { x: 50, y: 50 }
      const ov = overviewByKey[n]
      const errorRate = ov?.errorRate ?? 0
      const throughput = ov?.throughput ?? 0
      const latency = ov?.avgResponseTime ?? 0
      let status: NodeData['status'] = 'healthy'
      if (errorRate > 5 || latency > 500) status = 'critical'
      else if (errorRate > 1 || latency > 200) status = 'warning'

      return {
        id: n,
        name: n,
        status,
        reqPerMin: throughput,
        throughput,
        errorRate,
        latency,
        x: pos.x,
        y: pos.y,
      }
    })

    return { nodes: nodeList, edges: dep.edges ?? [] }
  }, [dependencyMap, servicesOverview])

  const getStatusColor = (status: NodeData['status']) => {
    switch (status) {
      case 'healthy': return '#22c55e'
      case 'warning': return '#eab308'
      case 'critical': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getEdgeStrokeWidth = (volume: number) => {
    const max = Math.max(...edges.map((e) => e.volume ?? 1), 1)
    return Math.max(1, ((volume ?? 1) / max) * 6)
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-blue-400" />
            Service Map
          </h1>
        </div>
        <div className="py-12 text-center text-gray-400">Loading service map...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-blue-400" />
            Service Map
          </h1>
        </div>
        <div className="px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GitBranch className="w-8 h-8 text-blue-400" />
          Service Map
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Healthy
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> Warning
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Critical
          </span>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 overflow-auto">
        {nodes.length === 0 ? (
          <div className="py-12 text-center text-gray-500">No services in dependency map</div>
        ) : (
          <div
            className="relative"
            style={{ width: containerSize, height: containerSize, minWidth: containerSize, minHeight: containerSize }}
          >
            <svg
              className="absolute inset-0"
              width={containerSize}
              height={containerSize}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                </marker>
              </defs>
              {edges.map((edge, i) => {
                const fromNode = nodes.find((n) => n.id === edge.source)
                const toNode = nodes.find((n) => n.id === edge.target)
                if (!fromNode || !toNode) return null
                const x1 = (fromNode.x / 100) * containerSize
                const y1 = (fromNode.y / 100) * containerSize
                const x2 = (toNode.x / 100) * containerSize
                const y2 = (toNode.y / 100) * containerSize
                const strokeW = getEdgeStrokeWidth(edge.volume ?? 1)
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#6b7280"
                    strokeWidth={strokeW}
                    markerEnd="url(#arrowhead)"
                  />
                )
              })}
            </svg>

            {nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 w-28 p-2 rounded-lg bg-gray-700 border border-gray-600 hover:border-blue-500 transition-colors"
                style={{
                  left: `${(node.x / 100) * containerSize}px`,
                  top: `${(node.y / 100) * containerSize}px`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getStatusColor(node.status) }}
                  />
                  <span className="text-sm font-medium text-white truncate">{node.name}</span>
                </div>
                <span className="text-xs text-gray-400">{node.reqPerMin} req/min</span>
              </div>
            ))}
          </div>
        )}

        {selectedNode && (
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600 max-w-md">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getStatusColor(selectedNode.status) }}
              />
              {selectedNode.name}
            </h3>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-gray-400">Throughput</span>
                <p className="text-white font-medium">{selectedNode.throughput ?? selectedNode.reqPerMin} req/min</p>
              </div>
              <div>
                <span className="text-gray-400">Error Rate</span>
                <p className="text-white font-medium">{selectedNode.errorRate ?? 0}%</p>
              </div>
              <div>
                <span className="text-gray-400">Latency</span>
                <p className="text-white font-medium">{selectedNode.latency ?? 0}ms</p>
              </div>
              <div>
                <span className="text-gray-400">Status</span>
                <p className="text-white font-medium capitalize">{selectedNode.status}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
