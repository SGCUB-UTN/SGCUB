import { useEffect, useMemo, useState } from 'react'
import useEntered from '../../hooks/useEntered'
import { WIDTH_MOTION, grown } from '../shared/chartMotion'
import { KpiGrid } from '../shared/Kpi'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonBlock, SkeletonStatus, TableSkeletonRows } from '../shared/Skeleton'
import SectionHeading from '../shared/SectionHeading'
import { formatCount, formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'
import AffectedCategories from './AffectedCategories'
import MorosidadTable from './MorosidadTable'
import NotifyMorosidadModal from './NotifyMorosidadModal'
import PadronStatusChart from './PadronStatusChart'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const SECTION_CLASS = 'p-4 sm:p-5'

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

function BreakdownItem({ swatchClass, label, amount, tone }) {
  return (
    <li className="flex items-center gap-2 min-w-0 text-sm">
      <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${swatchClass}`} aria-hidden="true" />
      <span className="flex-1 min-w-0 truncate text-on-surface-variant">{label}</span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone}`} title={formatMoney(amount)}>{formatWholeMoney(amount)}</span>
    </li>
  )
}

function DebtKpi({ rows, total }) {
  const entered = useEntered()
  const capital = sumBy(rows, 'capital')
  const surcharges = sumBy(rows, 'recargos')
  const capitalShare = total > 0 ? (capital / total) * 100 : 0
  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Monto total adeudado</h3>
      <p className={`mt-1 text-2xl font-bold tabular-nums leading-tight ${total > 0 ? 'text-error' : 'text-on-surface'}`} title={formatMoney(total)}>
        {formatWholeMoney(total)}
      </p>
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2 gap-0.5" aria-hidden="true">
            {capital > 0 && <div className={`h-full rounded bg-outline-variant ${WIDTH_MOTION}`} style={{ width: grown(entered, `${capitalShare}%`) }} />}
            {surcharges > 0 && <div className="h-full flex-1 rounded bg-error" />}
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            <BreakdownItem swatchClass="bg-outline-variant" label="Cuota s/recargo" amount={capital} tone="text-on-surface" />
            <BreakdownItem swatchClass="bg-error" label="Recargos por mora" amount={surcharges} tone="text-error" />
          </ul>
        </>
      )}
    </div>
  )
}

function MorosidadKpis({ reporte }) {
  const delinquent = reporte.filas.length
  const showCategories = reporte.alcance_codigo !== 'categoria'
  return (
    <div className={showCategories ? '' : 'max-w-3xl'}>
      <KpiGrid columns={showCategories ? 3 : 2}>
        <DebtKpi rows={reporte.filas} total={Number(reporte.monto_total)} />
        <PadronStatusChart delinquent={delinquent} roster={reporte.padron} percentage={reporte.porcentaje_morosidad} />
        {showCategories && <AffectedCategories categories={reporte.categorias_afectadas ?? []} />}
      </KpiGrid>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <SkeletonStatus label="Consultando cuentas..." className="flex flex-col gap-5">
      <div className={PANEL_CLASS}>
        <HeadingSkeleton withAction />
        <div className={`${SECTION_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
          <div className="flex flex-col gap-3">
            <SkeletonBlock soft className="h-3.5 w-40" />
            <SkeletonBlock className="h-7 w-36" />
            <SkeletonBlock round className="h-2 w-full" />
          </div>
          <div className="flex items-center gap-4">
            <RingSkeleton size={120} stroke={16} />
            <LineSkeletons count={2} className="flex-1 flex flex-col gap-3" />
          </div>
          <LineSkeletons count={3} className="flex flex-col gap-4" />
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

function MorosidadReport({ reporte, isLoading, error }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [notifyOpen, setNotifyOpen] = useState(false)

  useEffect(() => {
    setSelectedIds(new Set())
  }, [reporte])

  const selectedRows = useMemo(
    () => reporte?.filas?.filter((fila) => selectedIds.has(fila.socio_id)) ?? [],
    [reporte, selectedIds],
  )

  const toggleRow = (socioId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(socioId)) next.delete(socioId)
      else next.add(socioId)
      return next
    })
  }

  const toggleAll = (select, rowsToToggle) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      rowsToToggle.forEach((fila) => (select ? next.add(fila.socio_id) : next.delete(fila.socio_id)))
      return next
    })
  }

  if (error) {
    return <p className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">{error}</p>
  }
  if (!reporte) {
    if (isLoading) return <ReportSkeleton />
    return <p className="py-12 text-center text-on-surface-variant">Elegí los filtros para generar el reporte.</p>
  }

  const scopeLabel = reporte.alcance_codigo === 'categoria' || reporte.alcance_codigo === 'genero'
    ? reporte.alcance
    : reporte.tipo

  return (
    <div className={`flex flex-col gap-5 transition-opacity ${isLoading ? 'opacity-60' : ''}`} aria-busy={isLoading}>
      <section className={PANEL_CLASS} aria-labelledby="morosidad-kpis-title">
        <SectionHeading
          id="morosidad-kpis-title"
          icon="monitoring"
          title="Indicadores de morosidad"
          className={HEADING_CLASS}
          actions={(
            <p className="text-sm text-on-surface-variant">
              {scopeLabel} · {reporte.periodo} · Actualizado el {reporte.fecha}
            </p>
          )}
        />
        <div className={SECTION_CLASS}>
          <MorosidadKpis reporte={reporte} />
        </div>
      </section>

      <section className={PANEL_CLASS} aria-labelledby="morosidad-resultados-title">
        <SectionHeading
          id="morosidad-resultados-title"
          icon="receipt_long"
          title="Detalle de morosidad"
          className={HEADING_CLASS}
        />
        {reporte.filas.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">task_alt</span>
            <p className="mt-2 font-semibold text-on-surface">No hay socios con deuda vencida para los filtros seleccionados.</p>
          </div>
        ) : (
          <MorosidadTable
            filas={reporte.filas}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onNotify={() => setNotifyOpen(true)}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </section>

      {notifyOpen && (
        <NotifyMorosidadModal
          opened
          rows={selectedRows}
          onClose={() => setNotifyOpen(false)}
          onSent={() => setSelectedIds(new Set())}
        />
      )}

      <p className="text-sm text-on-surface-variant">
        Las cuotas se consideran vencidas desde su primer vencimiento; el monto incluye los recargos por mora aplicados.
        {reporte.cuotas_vencidas_minimas > 1 && ` Se consideran morosos quienes tienen ${reporte.cuotas_vencidas_minimas} o más cuotas vencidas.`}
        {reporte.sin_cuenta > 0 && ` ${reporte.sin_cuenta} socio(s) del alcance no tienen cuenta corriente y no se incluyeron.`}
      </p>
    </div>
  )
}

export default MorosidadReport
