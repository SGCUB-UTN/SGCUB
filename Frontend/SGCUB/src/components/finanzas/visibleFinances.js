import { useEffect, useSyncExternalStore } from 'react'

let visibleIds = []
const listeners = new Set()

const emit = () => listeners.forEach((listener) => listener())

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => visibleIds

export function useShowsFinances(socioId) {
  useEffect(() => {
    if (!socioId) return undefined
    visibleIds = [...visibleIds, socioId]
    emit()
    return () => {
      const index = visibleIds.indexOf(socioId)
      visibleIds = visibleIds.filter((_, position) => position !== index)
      emit()
    }
  }, [socioId])
}

export function useFinancesVisible(socioId) {
  return useSyncExternalStore(subscribe, getSnapshot).includes(socioId)
}
