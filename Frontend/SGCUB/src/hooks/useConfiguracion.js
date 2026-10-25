import { useCallback, useEffect, useState } from 'react'
import {
  getConfiguracionFinanciera,
  getConfiguracionGeneral,
  getVersionesConfiguracionFinanciera,
  patchConfiguracionGeneral,
  postConfiguracionFinanciera,
} from '../api/configuracion'
import { createTipoDocumento, deleteTipoDocumento, getTiposDocumento, updateTipoDocumento } from '../api/documentacion'
import { deleteMedioPago, getMediosPago, patchMedioPago, postMedioPago } from '../api/mediosPago'

const fetchAll = () => Promise.all([
  getConfiguracionGeneral(),
  getConfiguracionFinanciera(),
  getVersionesConfiguracionFinanciera(),
  getMediosPago(),
  getTiposDocumento(),
])

// Everything the configuration screen shows, with the actions that change it
function useConfiguracion() {
  const [data, setData] = useState({ general: null, financiera: null, versiones: [], medios: [], tipos: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const apply = ([general, financiera, versiones, medios, tipos]) => {
    setData({ general, financiera, versiones, medios, tipos })
  }

  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((received) => {
        if (!cancelled) apply(received)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((changes) => setData((current) => ({ ...current, ...changes })), [])

  const saveGeneral = useCallback(async (changes) => {
    update({ general: await patchConfiguracionGeneral(changes) })
  }, [update])

  const saveFinancialVersion = useCallback(async (version) => {
    const created = await postConfiguracionFinanciera(version)
    const [financiera, versiones] = await Promise.all([getConfiguracionFinanciera(), getVersionesConfiguracionFinanciera()])
    update({ financiera, versiones })
    return created
  }, [update])

  const withMedios = useCallback((request) => async (...args) => {
    const result = await request(...args)
    update({ medios: await getMediosPago() })
    return result
  }, [update])

  const withTipos = useCallback((request) => async (...args) => {
    const result = await request(...args)
    update({ tipos: await getTiposDocumento() })
    return result
  }, [update])

  return {
    ...data,
    isLoading,
    error,
    saveGeneral,
    saveFinancialVersion,
    createMedio: withMedios(postMedioPago),
    updateMedio: withMedios(patchMedioPago),
    deleteMedio: withMedios(deleteMedioPago),
    createTipo: withTipos(createTipoDocumento),
    updateTipo: withTipos(updateTipoDocumento),
    deleteTipo: withTipos(deleteTipoDocumento),
  }
}

export default useConfiguracion
