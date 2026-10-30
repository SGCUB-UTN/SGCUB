import StatCard from '../shared/StatCard'
import { formatAmount } from '../personas/format'
import MorosidadTable from './MorosidadTable'

const formatPercentage = (value) => `${Number(value ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`

function MorosidadKpis({ reporte }) {
  const category = reporte.categoria_mas_afectada
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      <StatCard label="Monto total adeudado" value={formatAmount(reporte.monto_total)} icon="payments" tone={Number(reporte.monto_total) > 0 ? 'error' : 'neutral'} />
      <StatCard label="Cantidad de morosos" value={reporte.filas.length} caption={`de ${reporte.padron}`} icon="group" tone={reporte.filas.length ? 'warning' : 'neutral'} />
      <StatCard label="Porcentaje de morosidad" value={formatPercentage(reporte.porcentaje_morosidad)} icon="percent" />
      <StatCard
        label="Categoría más afectada"
        value={category?.nombre ?? '—'}
        caption={category ? formatAmount(category.monto) : undefined}
        icon="emoji_events"
        tone="info"
      />
    </div>
  )
}

function MorosidadReport({ reporte, isLoading, error }) {
  if (error) {
    return <p className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">{error}</p>
  }
  if (!reporte) {
    return <p className="py-12 text-center text-on-surface-variant">{isLoading ? 'Consultando cuentas...' : 'Elegí los filtros para generar el reporte.'}</p>
  }

  return (
    <div className={`flex flex-col transition-opacity ${isLoading ? 'opacity-60' : ''}`} aria-busy={isLoading}>
      <MorosidadKpis reporte={reporte} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 mb-3">
        <h2 id="morosidad-resultados-title" className="text-lg font-bold text-on-surface">Detalle de morosidad</h2>
        <p className="text-sm text-on-surface-variant">
          {reporte.alcance} · {reporte.tipo} · {reporte.periodo} · Actualizado el {reporte.fecha}
        </p>
      </div>

      {reporte.filas.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-outline-variant/50 rounded-md text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">task_alt</span>
          <p className="mt-2 font-semibold text-on-surface">No hay socios con deuda vencida para los filtros seleccionados.</p>
        </div>
      ) : (
        <section aria-labelledby="morosidad-resultados-title" className="bg-surface-container-lowest border border-outline-variant/30 rounded-md shadow-sm overflow-hidden">
          <MorosidadTable filas={reporte.filas} />
        </section>
      )}

      <p className="mt-3 text-sm text-on-surface-variant">
        Las cuotas se consideran vencidas desde su primer vencimiento; el monto incluye los recargos por mora aplicados.
        {reporte.cuotas_vencidas_minimas > 1 && ` Se consideran morosos quienes tienen ${reporte.cuotas_vencidas_minimas} o más cuotas vencidas.`}
        {reporte.sin_cuenta > 0 && ` ${reporte.sin_cuenta} socio(s) del alcance no tienen cuenta corriente y no se incluyeron.`}
      </p>
    </div>
  )
}

export default MorosidadReport
