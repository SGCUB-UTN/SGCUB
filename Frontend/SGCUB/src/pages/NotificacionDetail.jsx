import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getNotificacionById } from '../api/comunicaciones'
import { formatDni, formatPhone } from '../components/personas/format'
import { SecondaryButton } from '../components/personas/tabs/parts'
import DataTable from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import { PANEL_BODY_CLASS, PANEL_CLASS } from '../components/shared/panel'
import SectionHeading from '../components/shared/SectionHeading'
import { HeadingSkeleton, LineSkeletons, SkeletonStatus, TableSkeletonRows } from '../components/shared/Skeleton'
import StatusBadge from '../components/shared/StatusBadge'
import TableMessageRow from '../components/shared/TableMessageRow'
import TablePagination from '../components/shared/TablePagination'
import TableSearchInput from '../components/shared/TableSearchInput'
import TableTabs from '../components/shared/TableTabs'

const ESTADO_BADGES = {
  ENVIADA: { label: 'Enviada', tono: 'exito', icon: 'check_circle' },
  PROGRAMADA: { label: 'Programada', tono: 'alerta', icon: 'schedule' },
  FALLIDA: { label: 'Fallida', tono: 'error', icon: 'error' },
}

function formatFechaCompleta(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const fecha = d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const hora = d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${fecha} · ${hora}`
  } catch {
    return iso
  }
}

export default function NotificacionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notificacion, setNotificacion] = useState(null)

  const [tab, setTab] = useState('TODOS')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')

    getNotificacionById(id)
      .then((data) => {
        if (!active) return
        setNotificacion(data)
      })
      .catch((err) => {
        if (!active) return
        setError(
          err?.response?.data?.detail ||
          'No se pudo encontrar o cargar el detalle de la notificación solicitada.'
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  const envios = useMemo(() => notificacion?.envios || [], [notificacion])

  const metrics = useMemo(() => {
    const total = envios.length
    const exitosos = envios.filter((e) => e.estado === 'ENVIADA').length
    const fallidos = envios.filter((e) => e.estado === 'FALLIDA').length
    const tasa = total > 0 ? Math.round((exitosos / total) * 1000) / 10 : 0
    const canales = [...new Set(envios.map((e) => e.canal))]
    return {
      total,
      exitosos,
      fallidos,
      tasa,
      canales,
    }
  }, [envios])

  const tabsOptions = useMemo(
    () => [
      { value: 'TODOS', label: 'Todos', count: metrics.total },
      { value: 'ENVIADA', label: 'Entregados', count: metrics.exitosos },
      { value: 'FALLIDA', label: 'Fallidos', count: metrics.fallidos },
    ],
    [metrics]
  )

  const filteredEnvios = useMemo(() => {
    const q = search.trim().toLowerCase()
    return envios.filter((e) => {
      if (tab !== 'TODOS' && e.estado !== tab) return false
      if (!q) return true
      return (
        (e.socio_nombre || '').toLowerCase().includes(q) ||
        (e.socio_dni || '').toLowerCase().includes(q) ||
        (e.destinatario_contacto || '').toLowerCase().includes(q) ||
        (e.canal || '').toLowerCase().includes(q)
      )
    })
  }, [envios, tab, search])

  const totalPages = Math.max(1, Math.ceil(filteredEnvios.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const paginatedEnvios = filteredEnvios.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          breadcrumb={[
            { label: 'Comunicaciones', to: '/comunicaciones' },
            { label: 'Cargando...' },
          ]}
          title="Detalle de notificación"
        />
        <SkeletonStatus label="Cargando detalle de la notificación..." className="flex flex-col gap-5">
          <div className={PANEL_CLASS}>
            <HeadingSkeleton />
            <div className={PANEL_BODY_CLASS}>
              <LineSkeletons count={3} className="flex flex-col gap-3" />
            </div>
          </div>
          <div className={PANEL_CLASS}>
            <HeadingSkeleton withAction />
            <table className="w-full">
              <tbody>
                <TableSkeletonRows colSpan={5} animated={false} />
              </tbody>
            </table>
          </div>
        </SkeletonStatus>
      </div>
    )
  }

  if (error || !notificacion) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          breadcrumb={[
            { label: 'Comunicaciones', to: '/comunicaciones' },
            { label: 'Error' },
          ]}
          title="Notificación no encontrada"
          actions={
            <SecondaryButton icon="arrow_back" onClick={() => navigate('/comunicaciones')}>
              Volver al historial
            </SecondaryButton>
          }
        />
        <div className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">
          {error || 'No se encontró la notificación seleccionada.'}
        </div>
      </div>
    )
  }

  const badge = ESTADO_BADGES[notificacion.estado] || {
    label: notificacion.estado || 'Enviada',
    tono: 'neutral',
    icon: 'info',
  }

  const emisor = notificacion.usuario_nombre || 'Sistema'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Comunicaciones', to: '/comunicaciones' },
          { label: `Comunicado #${notificacion.id}` },
        ]}
        title={notificacion.asunto || notificacion.titulo || `Comunicado #${notificacion.id}`}
        subtitle={`Enviado el ${formatFechaCompleta(notificacion.fecha_creacion)} · Responsable: ${emisor}`}
        actions={
          <SecondaryButton
            type="button"
            icon="arrow_back"
            onClick={() => navigate('/comunicaciones')}
          >
            Volver al historial
          </SecondaryButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <section className={`lg:col-span-2 ${PANEL_CLASS}`} aria-labelledby="mensaje-notif-title">
          <SectionHeading
            id="mensaje-notif-title"
            icon="mail"
            title="Contenido del comunicado"
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge badge={badge} />
              </div>
            }
          />
          <div className={`${PANEL_BODY_CLASS} flex flex-col gap-4`}>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-1">
                Asunto
              </span>
              <p className="text-base font-bold text-on-surface">
                {notificacion.asunto || notificacion.titulo || 'Sin asunto'}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Mensaje enviado
              </span>
              <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
                {notificacion.contenido || '—'}
              </div>
            </div>
          </div>
        </section>

        <section className={PANEL_CLASS} aria-labelledby="resumen-envio-title">
          <SectionHeading
            id="resumen-envio-title"
            icon="analytics"
            title="Resumen del despacho"
          />
          <div className={`${PANEL_BODY_CLASS} flex flex-col gap-3.5 text-xs`}>
            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Estado general:</span>
              <StatusBadge badge={badge} />
            </div>

            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Enviado por:</span>
              <span className="font-semibold text-on-surface">{emisor}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Fecha y hora:</span>
              <span className="font-semibold text-on-surface tabular-nums">
                {formatFechaCompleta(notificacion.fecha_creacion)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Destinatarios totales:</span>
              <span className="font-bold text-on-surface tabular-nums text-sm">
                {metrics.total}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Entregados con éxito:</span>
              <span className="font-bold text-success tabular-nums text-sm">
                {metrics.exitosos}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Envíos fallidos:</span>
              <span className={`font-bold tabular-nums text-sm ${metrics.fallidos > 0 ? 'text-error' : 'text-on-surface'}`}>
                {metrics.fallidos}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
              <span className="text-on-surface-variant font-medium">Tasa de entrega:</span>
              <span className="font-bold text-primary tabular-nums text-sm">
                {metrics.total > 0 ? `${metrics.tasa}%` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-on-surface-variant font-medium">Canales utilizados:</span>
              <div className="flex items-center gap-1.5">
                {metrics.canales.includes('MAIL') && (
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[11px]">
                    Email
                  </span>
                )}
                {metrics.canales.includes('WHATSAPP') && (
                  <span className="px-2 py-0.5 rounded bg-success/10 text-success font-semibold text-[11px]">
                    WhatsApp
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className={PANEL_CLASS} aria-labelledby="destinatarios-tabla-title">
        <SectionHeading
          id="destinatarios-tabla-title"
          icon="group"
          title={`Destinatarios (${metrics.total})`}
          actions={
            <TableSearchInput
              value={search}
              onChange={(val) => {
                setSearch(val)
                setPage(1)
              }}
              label="Buscar por destinatario o contacto"
              placeholder="Buscar por socio, DNI o contacto..."
              className="w-64 sm:w-72"
            />
          }
        />

        <TableTabs
          id="notificacion-destinatarios-tabs"
          label="Filtrar destinatarios por resultado"
          options={tabsOptions}
          value={tab}
          onChange={(newTab) => {
            setTab(newTab)
            setPage(1)
          }}
        />

        <DataTable
          headers={
            <>
              <th scope="col" className="py-3 px-4">Destinatario</th>
              <th scope="col" className="py-3 px-4">Canal</th>
              <th scope="col" className="py-3 px-4">Contacto</th>
              <th scope="col" className="py-3 px-4">Estado</th>
              <th scope="col" className="py-3 px-4">Detalle / Motivo</th>
            </>
          }
        >
          <TableMessageRow
            colSpan={5}
            isEmpty={paginatedEnvios.length === 0}
            emptyText={
              envios.length === 0
                ? 'No se registraron destinatarios asociados a esta notificación.'
                : 'No se encontraron destinatarios con el filtro aplicado.'
            }
          />

          {paginatedEnvios.map((envio) => {
            const isMail = envio.canal === 'MAIL'
            const contactoRaw = envio.destinatario_contacto || ''
            const contactoDisplay = isMail
              ? contactoRaw || 'Sin correo registrado'
              : formatPhone(contactoRaw) || 'Sin teléfono'

            const envioBadge = ESTADO_BADGES[envio.estado] || {
              label: envio.estado || 'Enviado',
              tono: 'neutral',
              icon: 'info',
            }

            return (
              <tr key={envio.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="py-3 px-4">
                  {envio.socio ? (
                    <Link
                      to={`/padron/socios/${envio.socio}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {envio.socio_nombre || `Socio #${envio.socio}`}
                    </Link>
                  ) : (
                    <span className="font-semibold text-on-surface">
                      {envio.socio_nombre || 'Destinatario'}
                    </span>
                  )}
                  <p className="text-xs text-on-surface-variant tabular-nums mt-0.5">
                    {envio.socio_dni ? `DNI ${formatDni(envio.socio_dni)}` : ''}
                    {envio.socio_numero ? ` · Socio #${envio.socio_numero}` : ''}
                  </p>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {isMail ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">mail</span>
                      Email
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/10 text-success text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">chat</span>
                      WhatsApp
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs font-mono text-on-surface">
                  {contactoDisplay}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <StatusBadge badge={envioBadge} />
                </td>
                <td className="py-3 px-4 text-xs max-w-sm">
                  {envio.estado === 'FALLIDA' ? (
                    <span className="text-error font-medium">
                      {envio.detalle_fallo || 'Error en el despacho'}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">
                      Entregado correctamente
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </DataTable>

        {filteredEnvios.length > 0 && (
          <TablePagination
            page={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(newSize) => {
              setRowsPerPage(newSize)
              setPage(1)
            }}
          />
        )}
      </section>
    </div>
  )
}
