import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Server, Search, Cpu, HardDrive, Activity } from 'lucide-react'
import api from '../services/api'

interface HostListItem {
  hostname: string
  latest_metrics: {
    hostname?: string
    timestamp?: string
    cpu_percent?: number
    memory_percent?: number
    disk_usage?: number
    network_io?: { bytes_sent?: number; bytes_recv?: number }
  }
}

interface HostDetail extends HostListItem {
  metrics_history?: Array<{
    timestamp?: string
    cpu_percent?: number
    memory_percent?: number
    disk_usage?: number
    network_io?: { bytes_sent?: number; bytes_recv?: number }
  }>
  processes?: Array<{
    pid?: number
    name?: string
    cpu_percent?: number
    memory_percent?: number
  }>
  containers?: Array<{
    id?: string
    name?: string
    state?: string
    image?: string
  }>
}

interface Container {
  id: string
  name: string
  image?: string
  cpu?: number
  memory?: string
  status: string
}

interface Process {
  pid: number
  name: string
  cpu: number
  memory: string
  status: string
}

export default function InfrastructurePage() {
  const [hosts, setHosts] = useState<HostListItem[]>([])
  const [selectedHost, setSelectedHost] = useState<HostListItem | null>(null)
  const [hostDetail, setHostDetail] = useState<HostDetail | null>(null)
  const [hostnameFilter, setHostnameFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.get<HostListItem[]>('/api/v1/infrastructure/hosts')
      .then((res) => {
        if (!cancelled) setHosts(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? err.message ?? 'Failed to load hosts')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedHost?.hostname) {
      setHostDetail(null)
      setDetailError(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    api.get<HostDetail>(`/api/v1/infrastructure/hosts/${selectedHost.hostname}`)
      .then((res) => {
        if (!cancelled) setHostDetail(res.data)
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err.response?.data?.detail ?? err.message ?? 'Failed to load host detail')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedHost?.hostname])

  const filteredHosts = hosts.filter((h) =>
    !hostnameFilter || h.hostname.toLowerCase().includes(hostnameFilter.toLowerCase())
  )

  const lm = (h: HostListItem) => h.latest_metrics || {}
  const cpu = (h: HostListItem) => lm(h).cpu_percent ?? 0
  const mem = (h: HostListItem) => lm(h).memory_percent ?? 0
  const disk = (h: HostListItem) => lm(h).disk_usage ?? 0
  const netIn = (h: HostListItem) => (lm(h).network_io?.bytes_recv ?? 0) / 1024 / 1024
  const netOut = (h: HostListItem) => (lm(h).network_io?.bytes_sent ?? 0) / 1024 / 1024

  const cpuData = (hostDetail?.metrics_history ?? []).map((m) => ({
    time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    cpu: m.cpu_percent ?? 0,
  }))
  const memData = (hostDetail?.metrics_history ?? []).map((m) => ({
    time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    mem: m.memory_percent ?? 0,
  }))
  const diskData = (hostDetail?.metrics_history ?? []).map((m) => ({
    time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    disk: m.disk_usage ?? 0,
  }))
  const networkData = (hostDetail?.metrics_history ?? []).map((m) => ({
    time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    in: ((m.network_io?.bytes_recv ?? 0) / 1024 / 1024),
    out: ((m.network_io?.bytes_sent ?? 0) / 1024 / 1024),
  }))

  const containers: Container[] = (hostDetail?.containers ?? []).map((c, i) => ({
    id: c.id ?? String(i),
    name: c.name ?? '-',
    image: c.image ?? '-',
    status: c.state ?? 'unknown',
  }))

  const processes: Process[] = (hostDetail?.processes ?? []).map((p) => ({
    pid: p.pid ?? 0,
    name: p.name ?? '-',
    cpu: p.cpu_percent ?? 0,
    memory: p.memory_percent ? `${p.memory_percent.toFixed(1)}%` : '-',
    status: 'running',
  }))

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Server className="w-8 h-8 text-blue-400" />
          Infrastructure
        </h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by hostname..."
              value={hostnameFilter}
              onChange={(e) => setHostnameFilter(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading hosts...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
          {filteredHosts.map((host) => (
            <div
              key={host.hostname}
              onClick={() => setSelectedHost(host)}
              className={`bg-gray-800 rounded-lg border p-6 cursor-pointer transition-all hover:border-gray-600 ${
                selectedHost?.hostname === host.hostname ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700/50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-700/50">
                    <Server className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{host.hostname}</h3>
                    <p className="text-sm text-gray-400">Host</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, cpu(host))}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-300 w-10">{cpu(host)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.min(100, mem(host))}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-300 w-10">{mem(host)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, disk(host))}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-300 w-10">{disk(host)}%</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Network: ↓{netIn(host).toFixed(2)} MB ↑{netOut(host).toFixed(2)} MB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredHosts.length === 0 && !loading && (
        <div className="py-12 text-center text-gray-500">No hosts found</div>
      )}

      {selectedHost && (
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            {selectedHost.hostname} — Time Series
          </h2>

          {detailError && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
              {detailError}
            </div>
          )}

          {detailLoading ? (
            <div className="py-12 text-center text-gray-400">Loading host details...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">CPU %</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cpuData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Memory %</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={memData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Area type="monotone" dataKey="mem" stroke="#10b981" fill="#10b98140" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Disk %</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={diskData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Area type="monotone" dataKey="disk" stroke="#f59e0b" fill="#f59e0b40" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Network I/O (MB)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={networkData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Bar dataKey="in" fill="#3b82f6" name="In" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="out" fill="#8b5cf6" name="Out" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Containers</h3>
                  <div className="bg-gray-700/50 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Name</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Image</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {containers.map((c) => (
                          <tr key={c.id} className="border-b border-gray-600/50 last:border-0">
                            <td className="px-4 py-2 text-white">{c.name}</td>
                            <td className="px-4 py-2 text-gray-400">{c.image}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">{c.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {containers.length === 0 && (
                      <div className="px-4 py-6 text-center text-gray-500">No containers</div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Top Processes</h3>
                  <div className="bg-gray-700/50 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">PID</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Name</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">CPU%</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Memory</th>
                          <th className="px-4 py-2 text-left text-gray-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processes.map((p) => (
                          <tr key={p.pid} className="border-b border-gray-600/50 last:border-0">
                            <td className="px-4 py-2 text-gray-400 font-mono">{p.pid}</td>
                            <td className="px-4 py-2 text-white">{p.name}</td>
                            <td className="px-4 py-2 text-gray-300">{p.cpu}</td>
                            <td className="px-4 py-2 text-gray-300">{p.memory}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {processes.length === 0 && (
                      <div className="px-4 py-6 text-center text-gray-500">No processes</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
