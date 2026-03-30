import api from '../../services/api'
import type { ErrorGroupApi, ErrorTriagePatchBody } from './types'

export async function fetchErrorGroups(params: Record<string, string> = {}): Promise<ErrorGroupApi[]> {
  const { data } = await api.get<ErrorGroupApi[]>('/api/v1/errors/groups', { params })
  return data ?? []
}

export async function fetchErrorGroupByFingerprint(fingerprint: string): Promise<ErrorGroupApi> {
  const { data } = await api.get<ErrorGroupApi>(
    `/api/v1/errors/groups/${encodeURIComponent(fingerprint)}`
  )
  return data
}

export async function patchErrorGroupTriage(
  fingerprint: string,
  body: ErrorTriagePatchBody
): Promise<void> {
  await api.patch(`/api/v1/errors/groups/${encodeURIComponent(fingerprint)}/triage`, {
    status: body.status,
    assignee: body.assignee,
    notes: body.notes,
  })
}
