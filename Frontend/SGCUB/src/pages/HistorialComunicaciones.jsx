import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getComunicacionesKPIs, getHistorialNotificaciones } from '../api/comunicaciones'
import { getSocios } from '../api/socios'
import ComunicacionesKPIs from '../components/comunicaciones/ComunicacionesKPIs'
import ExcludedListModal from '../components/comunicaciones/ExcludedListModal'
import HistorialComunicacionesTable from '../components/comunicaciones/HistorialComunicacionesTable'
import { PrimaryButton, SecondaryButton } from '../components/personas/tabs/parts'
import PageHeader from '../components/shared/PageHeader'
import { PANEL_BODY_CLASS, PANEL_CLASS } from '../components/shared/panel'
import {
  HeadingSkeleton,
  LineSkeletons,
  RingSkeleton,
  SkeletonBlock,
  SkeletonStatus,
  TableSkeletonRows,
} from '../components/shared/Skeleton'

function DashboardSkeleton() {
  return (
    <SkeletonStatus label="Cargando panel de comunicaciones..." className="flex flex-col gap-5">
      <div className={PANEL_CLASS}>
        <HeadingSkeleton withAction />
        <div className={`${PANEL_BODY_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
          {[0, 1].map((idx) => (
            <div key={idx} className="flex items-center gap-4">
              <RingSkeleton size={112} stroke={14} />
              <LineSkeletons count={3} className="flex-1 flex flex-col gap-3" />
            </div>
          ))}
          <div className="flex flex-col gap-3">
            <SkeletonBlock soft className="h-3.5 w-36" />
            <LineSkeletons count={2} className="flex flex-col gap-3" />
          </div>
        </div>
      </div>
      <div className={PANEL_CLASS}>
        <HeadingSkeleton withAction />
        <table className="w-full">
          <tbody>
            <TableSkeletonRows colSpan={6} animated={false} />
          </tbody>
        </table>
      </div>
    </SkeletonStatus>
  )
}

export default function HistorialComunicaciones() {
  const navigate = useNavigate()
  const location = useLocation()
  const debtNotice = location.state?.debtNotice
  const initialFlash = location.state?.flashResult || null

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [kpis, setKpis] = useState(null)
  const [notificaciones, setNotificaciones] = useState([])
  const [socios, setSocios] = useState([])
  const [isExcludedOpen, setIsExcludedOpen] = useState(false)
  const [flashResult, setFlashResult] = useState(initialFlash)

  useEffect(() => {
    if (debtNotice) {
      navigate('/comunicaciones/nuevo', { state: { debtNotice }, replace: true })
    }
  }, [debtNotice, navigate])

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [kpisRes, notifRes, sociosRes] = await Promise.allSettled([
        getComunicacionesKPIs(),
        getHistorialNotificaciones(),
        getSocios(),
      ])

      if (kpisRes.status === 'fulfilled') {
        setKpis(kpisRes.value)
      }
      if (notifRes.status === 'fulfilled' && Array.isArray(notifRes.value)) {
        setNotificaciones(notifRes.value)
      }
      if (sociosRes.status === 'fulfilled' && Array.isArray(sociosRes.value)) {
        setSocios(sociosRes.value)
      }
      if (kpisRes.status === 'rejected' && notifRes.status === 'rejected') {
        setError('No se pudo cargar la información del panel de comunicaciones.')
      }
    } catch {
      setError('No se pudo cargar la información del panel de comunicaciones.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!debtNotice) {
      fetchDashboardData()
    }
  }, [debtNotice, fetchDashboardData])

  const sociosSinContacto = useMemo(() => {
    return socios.filter((s) => {
      const isActivo = !s.estado_administrativo_nombre || s.estado_administrativo_nombre === 'Activo'
      if (!isActivo) return false
      const hasEmail = Boolean(s.email && s.email.includes('@'))
      const hasPhone = Boolean(s.telefono && String(s.telefono).trim().length > 0)
      return !hasEmail && !hasPhone
    })
  }, [socios])

  const computedKpis = useMemo(() => {
    if (kpis) return kpis
    const totalNotif = notificaciones.length
    const todosEnvios = notificaciones.flatMap((n) => n.envios || [])
    const entregados = todosEnvios.filter((e) => e.estado === 'ENVIADA').length
    const fallidos = todosEnvios.filter((e) => e.estado === 'FALLIDA').length
    const tasa = todosEnvios.length > 0 ? Math.round((entregados / todosEnvios.length) * 1000) / 10 : 0
    return {
      envios_mes: totalNotif,
      notificaciones_totales: totalNotif,
      mensajes_entregados: entregados,
      mensajes_fallidos: fallidos,
      mensajes_totales: todosEnvios.length,
      tasa_entrega: tasa,
      sin_contacto: sociosSinContacto.length,
    }
  }, [kpis, notificaciones, sociosSinContacto])

  if (debtNotice) return null

  const flashEnvios = flashResult?.envios || []
  const flashExitosos = flashEnvios.filter((e) => e.estado === 'ENVIADA').length
  const flashFallidos = flashEnvios.filter((e) => e.estado === 'FALLIDA').length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Comunicaciones' }, { label: 'Panel e historial' }]}
        title="Comunicaciones"
        subtitle="Resumen de envíos institucionales, cobertura de contacto del padrón e historial de notificaciones."
        actions={
          <PrimaryButton
            type="button"
            icon="send"
            onClick={() => navigate('/comunicaciones/nuevo')}
          >
            Nuevo envío
          </PrimaryButton>
        }
      />

      {flashResult && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-sm ${
            flashResult.estado === 'FALLIDA'
              ? 'bg-error-container/40 border-error/30 text-on-error-container'
              : 'bg-success-container/35 border-success/30 text-on-surface'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`material-symbols-outlined text-[22px] shrink-0 ${
                flashResult.estado === 'FALLIDA' ? 'text-error' : 'text-success'
              }`}
              aria-hidden="true"
            >
              {flashResult.estado === 'FALLIDA' ? 'error' : 'check_circle'}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">
                {flashResult.estado === 'FALLIDA'
                  ? `El envío "${flashResult.asunto || flashResult.titulo}" registró fallos de entrega`
                  : `Comunicado "${flashResult.asunto || flashResult.titulo}" procesado correctamente`}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {flashExitosos} {flashExitosos === 1 ? 'envío entregado' : 'envíos entregados'}
                {flashFallidos > 0
                  ? ` · ${flashFallidos} ${flashFallidos === 1 ? 'envío fallido' : 'envíos fallidos'}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SecondaryButton
              type="button"
              icon="visibility"
              onClick={() => navigate(`/comunicaciones/${flashResult.id}`)}
            >
              Ver detalle
            </SecondaryButton>
            <button
              type="button"
              onClick={() => setFlashResult(null)}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <ComunicacionesKPIs
            kpis={computedKpis}
            onOpenExcluded={() => setIsExcludedOpen(true)}
          />
          <HistorialComunicacionesTable
            notificaciones={notificaciones}
            onViewDetail={(notif) => navigate(`/comunicaciones/${notif.id}`)}
          />
        </>
      )}

      <ExcludedListModal
        isOpen={isExcludedOpen}
        onClose={() => setIsExcludedOpen(false)}
        excludedList={sociosSinContacto}
      />
    </div>
  )
}
