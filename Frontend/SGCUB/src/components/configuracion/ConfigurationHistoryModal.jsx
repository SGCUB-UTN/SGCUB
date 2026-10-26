import { useEffect, useMemo, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getHistorialConfiguracion } from '../../api/configuracion'
import { CUOTA_FIELD_LABELS, formatCuotaValue, formatVigencia } from './financialFields'
import { Notice } from './settingsParts'

const HISTORY_SECTIONS = [
  { value: '', label: 'Todas' },
  { value: 'Finanzas', label: 'Finanzas y facturación' },
  { value: 'Documentacion', label: 'Documentación' },
  { value: 'Comunicaciones', label: 'Comunicaciones' },
  { value: 'Club', label: 'Datos del club' },
]

const sectionLabel = (value) => HISTORY_SECTIONS.find((section) => section.value === value)?.label ?? value

const formatDateTime = (value) => new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

// The surcharge types the previous version had, to format its surcharge values
const previousValues = (version) => ({
  ...version,
  ...Object.fromEntries(version.cambios.map((cambio) => [cambio.campo, cambio.anterior])),
})

// Cuota versions and immediate changes in a single timeline, most recent first
const buildEntries = (versions, changes) => [
  ...versions.map((version) => ({
    key: `version-${version.configuracion_financiera_id}`,
    fecha: version.fecha_creacion,
    responsable: version.responsable,
    usuario: version.usuario_nombre,
    seccion: 'Finanzas',
    lines: version.cambios.length
      ? version.cambios.map((cambio) => `${CUOTA_FIELD_LABELS[cambio.campo]}: ${formatCuotaValue(cambio.campo, cambio.anterior, previousValues(version))} → ${formatCuotaValue(cambio.campo, cambio.nuevo, version)}`)
      : ['Configuración inicial de las cuotas'],
    vigencia: formatVigencia(version.periodo_vigencia),
    detail: version.cuotas_actualizadas ? `${version.cuotas_actualizadas} cuotas actualizadas` : '',
  })),
  ...changes.map((change) => ({
    key: `change-${change.historial_configuracion_id}`,
    fecha: change.fecha,
    responsable: change.responsable,
    usuario: change.usuario_nombre,
    seccion: change.seccion,
    lines: [`${change.campo}: ${change.valor_anterior || '—'} → ${change.valor_nuevo || '—'}`],
    vigencia: 'Inmediata',
    detail: '',
  })),
].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

function HistoryContent({ versions, initialSection }) {
  const [section, setSection] = useState(initialSection)
  const [load, setLoad] = useState({ changes: [], loading: true, error: false })

  useEffect(() => {
    let cancelled = false
    getHistorialConfiguracion()
      .then((changes) => {
        if (!cancelled) setLoad({ changes, loading: false, error: false })
      })
      .catch(() => {
        if (!cancelled) setLoad({ changes: [], loading: false, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const entries = useMemo(
    () => buildEntries(versions, load.changes).filter((entry) => !section || entry.seccion === section),
    [versions, load.changes, section],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por sección">
        {HISTORY_SECTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={section === option.value}
            onClick={() => setSection(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${section === option.value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {load.error && <Notice tone="error">No se pudo cargar el historial de cambios inmediatos.</Notice>}

      <div className="max-h-[60vh] overflow-auto rounded-lg border border-outline-variant/40">
        <table className="w-full min-w-[760px] text-left text-base">
          <thead className="sticky top-0 bg-surface-container-low text-sm uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Fecha</th>
              <th className="px-4 py-2.5 font-semibold">Responsable</th>
              <th className="px-4 py-2.5 font-semibold">Sección</th>
              <th className="px-4 py-2.5 font-semibold">Cambio</th>
              <th className="px-4 py-2.5 font-semibold">Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {load.loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">Cargando historial...</td></tr>
            )}
            {!load.loading && entries.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">No hay cambios registrados en esta sección.</td></tr>
            )}
            {!load.loading && entries.map((entry) => (
              <tr key={entry.key} className="border-t border-outline-variant/30 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{formatDateTime(entry.fecha)}</td>
                <td className="px-4 py-3 text-on-surface">
                  {entry.responsable || entry.usuario || 'Sistema'}
                  {entry.responsable && entry.usuario && (
                    <p className="text-sm text-on-surface-variant">Registrado por {entry.usuario}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{sectionLabel(entry.seccion)}</td>
                <td className="px-4 py-3 text-on-surface">
                  <ul className="flex flex-col gap-0.5">
                    {entry.lines.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  {entry.detail && <p className="mt-1 text-sm text-on-surface-variant">{entry.detail}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{entry.vigencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ConfigurationHistoryModal({ opened, onClose, versions, initialSection = '' }) {
  return (
    <Modal opened={opened} onClose={onClose} centered size="80rem" title={<Text fw={700} size="xl">Historial de configuración</Text>}>
      {opened && <HistoryContent versions={versions} initialSection={initialSection} />}
    </Modal>
  )
}
