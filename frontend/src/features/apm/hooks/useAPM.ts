import { useCallback, useEffect, useState } from 'react'
import * as apmApi from '../api'
import type {
  APMService,
  DatabaseQueriesResponse,
  ExternalServicesResponse,
  OverviewResponse,
  TransactionApi,
  TransactionsResponse,
} from '../types'

export function useAPMServices() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<APMService[]>([])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await apmApi.fetchServicesOverview()
      setServices(rows.map(apmApi.mapOverviewToAPMService))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services')
      setServices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { loading, error, services, refetch }
}

export function useAPMServiceOverview(serviceName: string | undefined) {
  const [loading, setLoading] = useState(!!serviceName)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)

  const refetch = useCallback(async () => {
    if (!serviceName) return
    const sn = decodeURIComponent(serviceName)
    setLoading(true)
    setError(null)
    try {
      const data = await apmApi.fetchServiceOverview(sn)
      setOverview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview')
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [serviceName])

  useEffect(() => {
    if (!serviceName) {
      setLoading(false)
      setOverview(null)
      setError(null)
      return
    }
    void refetch()
  }, [serviceName, refetch])

  return { loading, error, overview, refetch }
}

export function useAPMServiceTransactions(serviceName: string | undefined) {
  const [loading, setLoading] = useState(!!serviceName)
  const [error, setError] = useState<string | null>(null)
  const [transactionsData, setTransactionsData] = useState<TransactionsResponse | null>(null)
  const [slowTransactions, setSlowTransactions] = useState<TransactionApi[]>([])

  const refetch = useCallback(async () => {
    if (!serviceName) return
    const sn = decodeURIComponent(serviceName)
    setLoading(true)
    setError(null)
    try {
      const [tx, slow] = await Promise.all([
        apmApi.fetchServiceTransactions(sn),
        apmApi.fetchSlowTransactions(sn),
      ])
      setTransactionsData(tx)
      setSlowTransactions(slow)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
      setTransactionsData(null)
      setSlowTransactions([])
    } finally {
      setLoading(false)
    }
  }, [serviceName])

  useEffect(() => {
    if (!serviceName) {
      setLoading(false)
      setTransactionsData(null)
      setSlowTransactions([])
      setError(null)
      return
    }
    void refetch()
  }, [serviceName, refetch])

  return { loading, error, transactionsData, slowTransactions, refetch }
}

export function useAPMDatabaseQueries(serviceName: string | undefined, enabled: boolean) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DatabaseQueriesResponse | null>(null)

  const refetch = useCallback(async () => {
    if (!serviceName || !enabled) return
    const sn = decodeURIComponent(serviceName)
    setLoading(true)
    setError(null)
    try {
      const res = await apmApi.fetchDatabaseQueries(sn)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load database queries')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [serviceName, enabled])

  useEffect(() => {
    if (!serviceName || !enabled) {
      setLoading(false)
      return
    }
    void refetch()
  }, [serviceName, enabled, refetch])

  return { loading, error, databaseQueries: data, refetch }
}

export function useAPMExternalServicesMetrics(serviceName: string | undefined, enabled: boolean) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ExternalServicesResponse | null>(null)

  const refetch = useCallback(async () => {
    if (!serviceName || !enabled) return
    const sn = decodeURIComponent(serviceName)
    setLoading(true)
    setError(null)
    try {
      const res = await apmApi.fetchExternalServicesMetrics(sn)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load external services')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [serviceName, enabled])

  useEffect(() => {
    if (!serviceName || !enabled) {
      setLoading(false)
      return
    }
    void refetch()
  }, [serviceName, enabled, refetch])

  return { loading, error, externalServices: data, refetch }
}
