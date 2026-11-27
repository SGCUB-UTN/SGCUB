import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { deleteCuota } from '../api/cuotas'
import AutomationStatus from '../components/cuota/AutomationStatus'
import BillingPhaseTracker from '../components/cuota/BillingPhaseTracker'
import DeleteCuotaModal from '../components/cuota/DeleteCuotaModal'
import GenerateCuotasModal from '../components/cuota/GenerateCuotasModal'
import PeriodKpis from '../components/cuota/PeriodKpis'
import PeriodSelector from '../components/cuota/PeriodSelector'
import SectionHeading from '../components/shared/SectionHeading'
import TaskRunLogModal from '../components/cuota/TaskRunLogModal'
import PeriodCuotasTable from '../components/cuota/PeriodCuotasTable'
import { isValidPeriod } from '../components/cuota/cuotaPeriod'
import PageHeader from '../components/shared/PageHeader'
import { currentPeriod, formatPeriod } from '../components/shared/periodFormat'
import useAssignBenefit from '../hooks/useAssignBenefit'
import useCuotaPeriod from '../hooks/useCuotaPeriod'
import useRegisterPayment from '../hooks/useRegisterPayment'
import SectionDivider from '../components/shared/SectionDivider'
import LoadErrorBanner from '../components/shared/LoadErrorBanner'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const SECTION_CLASS = 'p-4 sm:p-5'
const GENERATE_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-10 px-3 rounded bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'

function Cuotas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPeriod = searchParams.get('periodo')
  const period = isValidPeriod(requestedPeriod) ? requestedPeriod : currentPeriod()
  const { summary, cuotas, runs, reload } = useCuotaPeriod(period)
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const [modalEliminar, setModalEliminar] = useState(false)
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [logRun, setLogRun] = useState(null)
  const [generateOpen, setGenerateOpen] = useState(false)

  const changePeriod = (value) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set('periodo', value)
    return next
  })

  const resources = [summary, cuotas, runs]
  const failed = resources.filter((resource) => resource.error)
  const nothingLoaded = failed.length > 0 && resources.every((resource) => !resource.data)
  const errorMessage = () => {
    if (nothingLoaded) return `No pudimos traer los datos de ${formatPeriod(period)}. Revisá la conexión y probá de nuevo.`
    if (failed.every((resource) => resource.data)) return 'No pudimos actualizar los datos. Estás viendo los últimos que se cargaron.'
    return `No pudimos traer parte de los datos de ${formatPeriod(period)}. Revisá la conexión y probá de nuevo.`
  }

  const abrirEliminar = (row) => {
    setCuotaSeleccionada(row)
    setErrorFormulario('')
    setModalEliminar(true)
  }

  const cerrarModal = () => {
    setModalEliminar(false)
    setCuotaSeleccionada(null)
    setErrorFormulario('')
  }

  const eliminarCuota = async () => {
    if (!cuotaSeleccionada) return

    setGuardando(true)
    setErrorFormulario('')

    try {
      await deleteCuota(cuotaSeleccionada.cuota_id)
      cerrarModal()
      reload()
    } catch (requestError) {
      setErrorFormulario(requestError.response?.data?.detail || 'No se pudo eliminar la cuota.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Cuotas' }]}
        title="Cuotas"
        actions={(
          <button type="button" onClick={() => setGenerateOpen(true)} className={GENERATE_BUTTON_CLASS}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">request_quote</span>
            Generar cuotas
          </button>
        )}
      />
      <SectionDivider actions={<PeriodSelector value={period} onChange={changePeriod} />}>
        Resumen mensual
      </SectionDivider>
      {failed.length > 0 && <LoadErrorBanner message={errorMessage()} onRetry={reload} />}
      {!nothingLoaded && (
        <>
          <section className={PANEL_CLASS} aria-labelledby="billing-phase-title">
            <SectionHeading id="billing-phase-title" icon="checklist_rtl" title="Etapa del mes" className={HEADING_CLASS} />
            <div className="px-4 sm:px-5 py-3">
              <BillingPhaseTracker phases={summary.data?.phases} isLoading={summary.isLoading} error={summary.error} />
            </div>
            <AutomationStatus runs={runs.data} isLoading={runs.isLoading} error={runs.error} onOpenLog={setLogRun} />
          </section>

          <section className={PANEL_CLASS} aria-labelledby="period-kpis-title">
            <SectionHeading id="period-kpis-title" icon="monitoring" title="Indicadores del período" className={HEADING_CLASS} />
            <div className={SECTION_CLASS}>
              <PeriodKpis
                summary={summary.data}
                rows={cuotas.data}
                isLoading={summary.isLoading || cuotas.isLoading}
                error={summary.error || cuotas.error}
              />
            </div>
          </section>

          <section className={PANEL_CLASS} aria-labelledby="period-cuotas-title">
            <SectionHeading id="period-cuotas-title" icon="receipt_long" title={`Cuotas de ${formatPeriod(period)}`} className={HEADING_CLASS} />
            <PeriodCuotasTable
              key={period}
              rows={cuotas.data ?? []}
              isLoading={cuotas.isLoading}
              error={cuotas.error}
              period={period}
              onPay={(row) => openPayment({ socioId: row.socio_id, cuotaIds: [row.cuota_id], onSuccess: reload })}
              onAssignDiscount={(row) => openBenefit({ socioId: row.socio_id, cuotaId: row.cuota_id, onSuccess: reload })}
              onAssignScholarship={(row) => openBenefit({ socioId: row.socio_id, onSuccess: reload })}
              onDelete={abrirEliminar}
              onChanged={reload}
            />
          </section>
        </>
      )}

      <TaskRunLogModal run={logRun} onClose={() => setLogRun(null)} />

      <GenerateCuotasModal opened={generateOpen} onClose={() => setGenerateOpen(false)} onGenerated={reload} />

      <DeleteCuotaModal
        opened={modalEliminar}
        onClose={() => !guardando && cerrarModal()}
        onConfirm={eliminarCuota}
        cuota={cuotaSeleccionada}
        loading={guardando}
        error={errorFormulario}
      />
    </div>
  )
}

export default Cuotas