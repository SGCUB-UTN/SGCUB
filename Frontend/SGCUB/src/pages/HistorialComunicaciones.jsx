import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PageHeader from '../components/shared/PageHeader'
import ComunicacionesKPIs from '../components/comunicaciones/ComunicacionesKPIs'
import HistorialComunicacionesTable from '../components/comunicaciones/HistorialComunicacionesTable'
import { getComunicacionesKPIs, getHistorialNotificaciones } from '../api/comunicaciones'
import useSocio from '../hooks/useSocio'

export default function HistorialComunicaciones() {
  const location = useLocation()
  const { socios } = useSocio()
  const [kpis, setKpis] = useState(null)
  const [historial, setHistorial] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)

  const fetchHistorial = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getHistorialNotificaciones()
      setHistorial(data)
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistorial()
    getComunicacionesKPIs()
      .then(setKpis)
      .catch((err) => console.error('Error al cargar métricas de comunicaciones:', err))
  }, [fetchHistorial])

  useEffect(() => {
    const message = location.state?.toastMessage
    if (!message) return undefined

    setToastMessage(message)
    setShowToast(true)
    const timeout = setTimeout(() => setShowToast(false), 4500)
    return () => clearTimeout(timeout)
  }, [location.state])

  const computedKPIs = useMemo(() => {
    const totalSocios = socios?.length || 0
    const sinContactoCount = (socios || []).filter((s) => !s.email && !s.telefono).length
    const conContactoCount = totalSocios - sinContactoCount
    const tasa = totalSocios > 0 ? ((conContactoCount / totalSocios) * 100).toFixed(1) : 100

    return {
      envios_mes: kpis?.envios_mes ?? 0,
      mensajes_entregados: kpis?.mensajes_entregados ?? 0,
      tasa_entrega: tasa,
      canales_activos_texto: 'Email corporativo y WhatsApp',
      sin_contacto: sinContactoCount,
    }
  }, [kpis, socios])

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1 max-w-full">
        <PageHeader
          breadcrumb={[{ label: 'Comunicaciones' }]}
          title="Historial de envíos"
        />
        <p className="text-sm text-on-surface-variant -mt-1.5">
          Consulte y actualice el registro de notificaciones enviadas.
        </p>
      </div>

      <ComunicacionesKPIs kpis={computedKPIs} />

      <HistorialComunicacionesTable
        notificaciones={historial}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchHistorial}
      />

      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in border border-outline-variant/20">
          <span className="material-symbols-outlined text-primary-container text-[20px]">
            check_circle
          </span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
