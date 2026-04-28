import { useAuth } from '@clerk/react'
import { useCallback } from 'react'
import { apiFetch } from '../lib/api'

export function useApiFetch() {
  const { getToken } = useAuth()

  return useCallback(
    (input: string, init: RequestInit = {}) => apiFetch(input, init, () => getToken()),
    [getToken],
  )
}
