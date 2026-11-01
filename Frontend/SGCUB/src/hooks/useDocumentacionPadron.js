import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPadronDocumental, getTiposDocumento } from '../api/documentacion'
import { documentRows } from '../components/documental/padronDocumental'

const EMPTY_PERSONAS = []
const EMPTY_TIPOS = []

export default function useDocumentacionPadron() {
  const [load, setLoad] = useState({ data: null, error: null })
  const [tipos, setTipos] = useState(EMPTY_TIPOS)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    getPadronDocumental()
      .then((data) => active && setLoad({ data, error: null }))
      .catch((error) => active && setLoad((current) => ({ data: current.data, error })))
    return () => { active = false }
  }, [version])

  useEffect(() => {
    let active = true
    getTiposDocumento()
      .then((data) => active && setTipos(data))
      .catch((error) => console.error('Error cargando tipos de documento:', error))
    return () => { active = false }
  }, [])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    window.addEventListener('documentacionCambiada', reload)
    return () => window.removeEventListener('documentacionCambiada', reload)
  }, [reload])

  const personas = load.data?.personas ?? EMPTY_PERSONAS
  const rows = useMemo(() => documentRows(personas), [personas])

  return {
    isLoading: load.data === null && load.error === null,
    error: load.error,
    personas,
    rows,
    tipos,
    resumen: load.data?.resumen ?? null,
    diasAlerta: load.data?.dias_alerta ?? null,
    reload,
  }
}
