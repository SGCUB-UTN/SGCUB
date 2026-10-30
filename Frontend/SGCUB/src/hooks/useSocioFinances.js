import { useCallback, useEffect, useState } from 'react'
import { getBecasBySocio } from '../api/becas'
import { getComprobantes } from '../api/comprobantes'
import { getDevoluciones } from '../api/devoluciones'
import { getEstadoCuenta } from '../api/estadoCuenta'

const fetchAccount = (socioId) => getEstadoCuenta(socioId).catch((requestError) => {
  if (requestError.response?.status === 404) return null
  throw requestError
})

// The scholarships and other movements sections show their own errors, so a failure there doesn't hide the account
const fetchScholarships = (socioId) => getBecasBySocio(socioId).catch(() => null)

// Incomes other than cuotas (their receipts) and refunds of the socio
const fetchOtherMovements = (socioId) => Promise.all([
  getComprobantes({ socio_id: socioId }),
  getDevoluciones({ socio_id: socioId }),
])
  .then(([comprobantes, devoluciones]) => ({ ingresos: comprobantes.filter((comprobante) => comprobante.es_ingreso), devoluciones }))
  .catch(() => null)

const fetchFinances = (socioId) => Promise.all([
  fetchAccount(socioId),
  fetchScholarships(socioId),
  fetchOtherMovements(socioId),
])

// Loads the socio's account statement, scholarships, incomes and refunds; reload refreshes them without showing the loading state
export default function useSocioFinances(socioId) {
  const [load, setLoad] = useState({ socioId: null, error: null, account: null, becas: [], movimientos: null })

  useEffect(() => {
    if (!socioId) return undefined
    let active = true
    fetchFinances(socioId)
      .then(([account, becas, movimientos]) => active && setLoad({ socioId, error: null, account, becas, movimientos }))
      .catch(() => active && setLoad({ socioId, error: 'No se pudo cargar el estado de cuenta.', account: null, becas: [], movimientos: null }))
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
    // { ingresos, devoluciones }, or null when they couldn't be loaded
    movimientos: loaded ? load.movimientos : null,
    reload,
  }
}
