import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getConfiguracionFinanciera,
  getConfiguracionGeneral,
  getVersionesConfiguracionFinanciera,
  guardarConfiguracion,
} from '../api/configuracion'
import { createTipoDocumento, deleteTipoDocumento, getTiposDocumento, updateTipoDocumento } from '../api/documentacion'
import { deleteMedioPago, getMediosPago, patchMedioPago, postMedioPago } from '../api/mediosPago'
import { CUOTA_FIELDS, validateCuotaForm } from '../components/configuracion/financialFields'
import { GENERAL_FIELDS } from '../components/configuracion/generalFields'
import { changedFields, messagesByField } from '../components/configuracion/settingsForm'

const fetchAll = () => Promise.all([
  getConfiguracionGeneral(),
  getConfiguracionFinanciera(),
  getVersionesConfiguracionFinanciera(),
  getMediosPago(),
  getTiposDocumento(),
])

const pick = (source, fields) => Object.fromEntries(fields.map((field) => [field, source?.[field] ?? '']))

const emptyDraft = (general, financiera) => ({
  general: pick(general, GENERAL_FIELDS),
  financiera: pick(financiera, CUOTA_FIELDS),
  logo: null,
  removeLogo: false,
})

/**
 * Everything the configuration screen shows. Settings are edited on a single draft that is saved at once
 * with `save`; payment methods and document types are catalogs that apply immediately.
 */
function useConfiguracion() {
  const [data, setData] = useState({ general: null, financiera: null, versiones: [], medios: [], tipos: [] })
  const [draft, setDraft] = useState(() => emptyDraft(null, null))
  const [errors, setErrors] = useState({ general: {}, financiera: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const restart = useCallback((general, financiera) => {
    setDraft(emptyDraft(general, financiera))
    setErrors({ general: {}, financiera: {} })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then(([general, financiera, versiones, medios, tipos]) => {
        if (cancelled) return
        setData({ general, financiera, versiones, medios, tipos })
        restart(general, financiera)
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
  }, [restart])

  const changes = useMemo(() => ({
    general: data.general ? changedFields(draft.general, data.general, GENERAL_FIELDS) : [],
    financiera: data.financiera ? changedFields(draft.financiera, data.financiera, CUOTA_FIELDS) : [],
    logo: Boolean(draft.logo) || draft.removeLogo,
  }), [data.general, data.financiera, draft])

  const isDirty = changes.general.length > 0 || changes.financiera.length > 0 || changes.logo

  const setGeneralField = useCallback((field, value) => {
    setDraft((current) => ({ ...current, general: { ...current.general, [field]: value } }))
    setErrors((current) => ({ ...current, general: { ...current.general, [field]: undefined } }))
  }, [])

  const setFinancialField = useCallback((field, value) => {
    setDraft((current) => ({ ...current, financiera: { ...current.financiera, [field]: value } }))
    setErrors((current) => ({ ...current, financiera: { ...current.financiera, [field]: undefined } }))
  }, [])

  const setLogo = useCallback((file) => {
    setDraft((current) => ({ ...current, logo: file, removeLogo: false }))
    setErrors((current) => ({ ...current, general: { ...current.general, club_logo: undefined } }))
  }, [])

  const removeLogo = useCallback(() => {
    setDraft((current) => ({ ...current, logo: null, removeLogo: Boolean(data.general?.club_logo) }))
  }, [data.general])

  const discard = useCallback(() => restart(data.general, data.financiera), [restart, data.general, data.financiera])

  // Checks the cuota parameters before asking for the responsable; returns whether they are valid
  const validate = useCallback(() => {
    const financialErrors = changes.financiera.length ? validateCuotaForm(draft.financiera) : {}
    setErrors((current) => ({ ...current, financiera: financialErrors }))
    return Object.keys(financialErrors).length === 0
  }, [changes.financiera, draft.financiera])

  const save = useCallback(async ({ responsable, periodo }) => {
    const payload = {
      responsable,
      general: Object.fromEntries(changes.general.map((field) => [field, draft.general[field]])),
      financiera: changes.financiera.length
        ? { periodo_vigencia: periodo, ...Object.fromEntries(changes.financiera.map((field) => [field, draft.financiera[field]])) }
        : null,
      quitar_logo: draft.removeLogo,
    }
    try {
      const result = await guardarConfiguracion(payload, draft.logo)
      const [financiera, versiones] = result.financiera
        ? await Promise.all([getConfiguracionFinanciera(), getVersionesConfiguracionFinanciera()])
        : [data.financiera, data.versiones]
      setData((current) => ({ ...current, general: result.general, financiera, versiones }))
      restart(result.general, financiera)
      return result
    } catch (requestError) {
      const received = requestError.response?.data ?? {}
      setErrors({ general: messagesByField(received.general), financiera: messagesByField(received.financiera) })
      throw requestError
    }
  }, [changes, draft, data.financiera, data.versiones, restart])

  const update = useCallback((changes) => setData((current) => ({ ...current, ...changes })), [])

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
    draft,
    errors,
    changes,
    isDirty,
    setGeneralField,
    setFinancialField,
    setLogo,
    removeLogo,
    discard,
    validate,
    save,
    createMedio: withMedios(postMedioPago),
    updateMedio: withMedios(patchMedioPago),
    deleteMedio: withMedios(deleteMedioPago),
    createTipo: withTipos(createTipoDocumento),
    updateTipo: withTipos(updateTipoDocumento),
    deleteTipo: withTipos(deleteTipoDocumento),
  }
}

export default useConfiguracion
