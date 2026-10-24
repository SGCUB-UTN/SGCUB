import { useCallback, useEffect, useState } from 'react'
import { getBecasBySocio } from '../api/becas'
import { getEstadoCuenta } from '../api/estadoCuenta'
import { getMovimientos } from '../api/movimientos'

const fetchAccount = (socioId) => getEstadoCuenta(socioId).catch((requestError) => {
  if (requestError.response?.status === 404) return null
  throw requestError
})

// The scholarships and manual movements sections show their own errors, so a failure there doesn't hide the account
const fetchScholarships = (socioId) => getBecasBySocio(socioId).catch(() => null)
const fetchManualMovements = (socioId) => getMovimientos(socioId, { soloManuales: true }).catch(() => null)

const fetchFinances = (socioId) => Promise.all([
  fetchAccount(socioId),
  fetchScholarships(socioId),
  fetchManualMovements(socioId),
])

// Loads the socio's account statement, scholarships, and manual movements; reload refreshes them without showing the loading state
export default function useSocioFinances(socioId) {
  const [load, setLoad] = useState({ socioId: null, error: null, account: null, becas: [], movimientos: [] })

  useEffect(() => {
    if (!socioId) return undefined
    let active = true
    fetchFinances(socioId)
      .then(([account, becas, movimientos]) => active && setLoad({ socioId, error: null, account, becas, movimientos }))
      .catch(() => active && setLoad({ socioId, error: 'No se pudo cargar el estado de cuenta.', account: null, becas: [], movimientos: [] }))
    return () => { active = false }
  }, [socioId])

  const reload = useCallback(() => fetchFinances(socioId)
    .then(([account, becas, movimientos]) => setLoad({ socioId, error: null, account, becas, movimientos }))
    .catch(() => setLoad((current) => ({ ...current, error: 'Los cambios se guardaron, pero no se pudo actualizar el estado de cuenta.' }))), [socioId])

  const loaded = Boolean(socioId) && load.socioId === socioId
  return {
    loading: Boolean(socioId) && !loaded,
    error: loaded ? load.error : null,
    account: loaded ? load.account : null,
    becas: loaded ? load.becas : [],
    movimientos: loaded ? load.movimientos : [],
    reload,
  }
}
