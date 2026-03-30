import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface Transaction {
  id: string
  endpoint: string
  method: string
  avgDuration: number
  p95: number
  throughput: number
  errorRate: number
  recentOccurrences?: Array<{ timestamp: string; duration: number; status: string }>
}

interface TransactionListProps {
  transactions: Transaction[]
  onSelect?: (transaction: Transaction) => void
}

type SortKey = 'endpoint' | 'method' | 'avgDuration' | 'p95' | 'throughput' | 'errorRate'
type SortOrder = 'asc' | 'desc'

const getMethodColor = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-green-900/50 text-green-400 border-green-600/50'
    case 'POST':
      return 'bg-blue-900/50 text-blue-400 border-blue-600/50'
    case 'PUT':
      return 'bg-yellow-900/50 text-yellow-400 border-yellow-600/50'
    case 'DELETE':
      return 'bg-red-900/50 text-red-400 border-red-600/50'
    case 'PATCH':
      return 'bg-purple-900/50 text-purple-400 border-purple-600/50'
    default:
      return 'bg-gray-700/50 text-gray-400 border-gray-600/50'
  }
}

export default function TransactionList({ transactions, onSelect }: TransactionListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('avgDuration')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number)
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const SortHeader = ({ label, sortKey: sk }: { label: string; sortKey: SortKey }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300"
      onClick={() => toggleSort(sk)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sk && (
          <span className="text-gray-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/50 shadow-sm bg-gray-800/50">
      <table className="min-w-full divide-y divide-gray-700/50">
        <thead className="bg-gray-900/80">
          <tr>
            <th className="px-6 py-3 w-8"></th>
            <SortHeader label="Endpoint" sortKey="endpoint" />
            <SortHeader label="Method" sortKey="method" />
            <SortHeader label="Avg Duration" sortKey="avgDuration" />
            <SortHeader label="P95" sortKey="p95" />
            <SortHeader label="Throughput" sortKey="throughput" />
            <SortHeader label="Error Rate" sortKey="errorRate" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50 bg-gray-800/30">
          {sortedTransactions.map((tx) => (
            <Fragment key={tx.id}>
              <tr
                key={tx.id}
                className="hover:bg-gray-700/50 cursor-pointer transition-colors"
                onClick={() => {
                  if (tx.recentOccurrences?.length) toggleExpand(tx.id)
                  onSelect?.(tx)
                }}
              >
                <td className="px-6 py-4">
                  {tx.recentOccurrences?.length ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand(tx.id)
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      {expandedRows.has(tx.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-white">
                  {tx.endpoint}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded border ${getMethodColor(
                      tx.method
                    )}`}
                  >
                    {tx.method}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {tx.avgDuration.toFixed(0)}ms
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {tx.p95.toFixed(0)}ms
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {tx.throughput}/min
                </td>
                <td className="px-6 py-4">
                  <span
                    className={
                      tx.errorRate > 5 ? 'text-red-400' : tx.errorRate > 1 ? 'text-yellow-400' : 'text-gray-300'
                    }
                  >
                    {tx.errorRate.toFixed(2)}%
                  </span>
                </td>
              </tr>
              {expandedRows.has(tx.id) && tx.recentOccurrences?.length && (
                <tr key={`${tx.id}-expanded`} className="bg-gray-900/60">
                  <td colSpan={7} className="px-6 py-4">
                    <div className="text-xs text-gray-400 space-y-1">
                      <div className="font-medium text-gray-300 mb-2">Recent occurrences</div>
                      {tx.recentOccurrences.map((occ, i) => (
                        <div
                          key={i}
                          className="flex justify-between py-1 px-2 rounded bg-gray-800/50"
                        >
                          <span>{new Date(occ.timestamp).toLocaleString()}</span>
                          <span>{occ.duration}ms</span>
                          <span
                            className={
                              occ.status === '200' ? 'text-green-400' : 'text-red-400'
                            }
                          >
                            {occ.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
