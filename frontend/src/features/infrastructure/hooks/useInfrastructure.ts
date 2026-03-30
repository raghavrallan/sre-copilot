import { useState, useEffect, useMemo } from 'react'
import * as infrastructureApi from '../api'
import type {
  ContainerRow,
  HostDetail,
  HostListItem,
  ProcessRow,
} from '../types'

export function useInfrastructure() {
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
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await infrastructureApi.fetchHosts()
        if (!cancelled) setHosts(data)
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as { response?: { data?: { detail?: string } }; message?: string }
          setError(e.response?.data?.detail ?? e.message ?? 'Failed to load hosts')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
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
    infrastructureApi
      .fetchHostDetail(selectedHost.hostname)
      .then((res) => {
        if (!cancelled) setHostDetail(res)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const e = err as { response?: { data?: { detail?: string } }; message?: string }
          setDetailError(e.response?.data?.detail ?? e.message ?? 'Failed to load host detail')
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedHost?.hostname])

  const filteredHosts = useMemo(
    () =>
      hosts.filter(
        (h) => !hostnameFilter || h.hostname.toLowerCase().includes(hostnameFilter.toLowerCase())
      ),
    [hosts, hostnameFilter]
  )

  const lm = (h: HostListItem) => h.latest_metrics || {}
  const cpu = (h: HostListItem) => lm(h).cpu_percent ?? 0
  const mem = (h: HostListItem) => lm(h).memory_percent ?? 0
  const disk = (h: HostListItem) => lm(h).disk_usage ?? 0
  const netIn = (h: HostListItem) => (lm(h).network_io?.bytes_recv ?? 0) / 1024 / 1024
  const netOut = (h: HostListItem) => (lm(h).network_io?.bytes_sent ?? 0) / 1024 / 1024

  const cpuData = useMemo(
    () =>
      (hostDetail?.metrics_history ?? []).map((m) => ({
        time: m.timestamp
          ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        cpu: m.cpu_percent ?? 0,
      })),
    [hostDetail?.metrics_history]
  )
  const memData = useMemo(
    () =>
      (hostDetail?.metrics_history ?? []).map((m) => ({
        time: m.timestamp
          ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        mem: m.memory_percent ?? 0,
      })),
    [hostDetail?.metrics_history]
  )
  const diskData = useMemo(
    () =>
      (hostDetail?.metrics_history ?? []).map((m) => ({
        time: m.timestamp
          ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        disk: m.disk_usage ?? 0,
      })),
    [hostDetail?.metrics_history]
  )
  const networkData = useMemo(
    () =>
      (hostDetail?.metrics_history ?? []).map((m) => ({
        time: m.timestamp
          ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
        in: (m.network_io?.bytes_recv ?? 0) / 1024 / 1024,
        out: (m.network_io?.bytes_sent ?? 0) / 1024 / 1024,
      })),
    [hostDetail?.metrics_history]
  )

  const containers: ContainerRow[] = useMemo(
    () =>
      (hostDetail?.containers ?? []).map((c, i) => ({
        id: c.id ?? String(i),
        name: c.name ?? '-',
        image: c.image ?? '-',
        status: c.state ?? 'unknown',
      })),
    [hostDetail?.containers]
  )

  const processes: ProcessRow[] = useMemo(
    () =>
      (hostDetail?.processes ?? []).map((p) => ({
        pid: p.pid ?? 0,
        name: p.name ?? '-',
        cpu: p.cpu_percent ?? 0,
        memory: p.memory_percent ? `${p.memory_percent.toFixed(1)}%` : '-',
        status: 'running',
      })),
    [hostDetail?.processes]
  )

  return {
    hosts,
    selectedHost,
    setSelectedHost,
    hostDetail,
    hostnameFilter,
    setHostnameFilter,
    loading,
    detailLoading,
    error,
    detailError,
    filteredHosts,
    cpu,
    mem,
    disk,
    netIn,
    netOut,
    cpuData,
    memData,
    diskData,
    networkData,
    containers,
    processes,
  }
}
