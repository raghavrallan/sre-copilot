export interface LoadingState {
  loading: boolean
  error: string | null
}

export interface ApiError {
  detail?: string
  message?: string
  status?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export function extractApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: string; message?: string } } }).response
    return resp?.data?.detail || resp?.data?.message || 'An error occurred'
  }
  if (err instanceof Error) return err.message
  return 'An error occurred'
}
