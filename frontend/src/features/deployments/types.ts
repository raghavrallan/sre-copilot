import { createElement, type ReactNode } from 'react'
import {
  CheckCircle,
  Loader2,
  XCircle,
  RotateCcw,
  Github,
  Server,
  Globe,
  Rocket,
} from 'lucide-react'

export interface DeploymentApi {
  deployment_id: string
  service: string
  version: string
  commit_sha: string
  description: string
  deployed_by: string
  timestamp: string
  started_at?: string
  status?: string
  source?: string
  environment?: string
}

export type DeploymentStatus = 'success' | 'failed' | 'in_progress' | 'rolled_back'

export interface Deployment {
  id: string
  service: string
  version: string
  commitSha: string
  description: string
  deployedBy: string
  timestamp: string
  status: DeploymentStatus
  source: string
  environment: string
}

export interface DeploymentStats {
  total: number
  success: number
  failed: number
  inProgress: number
  uniqueServices: number
  last24h: number
  successRate: number
}

export interface StatusConfigEntry {
  label: string
  textColor: string
  bgColor: string
  dotColor: string
  icon: ReactNode
}

export const STATUS_CONFIG: Record<DeploymentStatus, StatusConfigEntry> = {
  success: {
    label: 'Success',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    dotColor: 'bg-emerald-500',
    icon: createElement(CheckCircle, { className: 'w-4 h-4 text-emerald-600' }),
  },
  failed: {
    label: 'Failed',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    dotColor: 'bg-red-500',
    icon: createElement(XCircle, { className: 'w-4 h-4 text-red-600' }),
  },
  in_progress: {
    label: 'In Progress',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    dotColor: 'bg-amber-500',
    icon: createElement(Loader2, { className: 'w-4 h-4 text-amber-600 animate-spin' }),
  },
  rolled_back: {
    label: 'Rolled Back',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
    dotColor: 'bg-orange-500',
    icon: createElement(RotateCcw, { className: 'w-4 h-4 text-orange-600' }),
  },
}

export function mapApiToDeployment(raw: DeploymentApi): Deployment {
  return {
    id: raw.deployment_id,
    service: raw.service,
    version: raw.version,
    commitSha: raw.commit_sha,
    description: raw.description,
    deployedBy: raw.deployed_by,
    timestamp: raw.timestamp || raw.started_at || '',
    status: (raw.status as DeploymentStatus) || 'success',
    source: raw.source || 'manual',
    environment: raw.environment || 'production',
  }
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return 'just now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

export function formatDateGroup(dateStr: string): string {
  if (!dateStr) return 'Recent'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Recent'
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function getSourceIcon(source: string): ReactNode {
  switch (source) {
    case 'github':
      return createElement(Github, { className: 'w-3.5 h-3.5' })
    case 'azure_devops':
      return createElement(Server, { className: 'w-3.5 h-3.5' })
    case 'gitlab':
      return createElement(Globe, { className: 'w-3.5 h-3.5' })
    default:
      return createElement(Rocket, { className: 'w-3.5 h-3.5' })
  }
}
