import { useCallback, useSyncExternalStore } from 'react'
import { DualSenseClient } from './DualSenseClient'
import type { DualSenseSnapshot } from './types'

/**
 * React subscription for a shared DualSenseClient.
 *
 * Create one client outside the render path, then dispose it when the owning
 * application unmounts.
 */
export function useDualSense(client: DualSenseClient): DualSenseSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => client.subscribe(listener, false),
    [client],
  )
  const getSnapshot = useCallback(() => client.current, [client])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
