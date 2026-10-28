import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { deleteCuota, getCuota, patchCuota, postCuota } from '../api/cuotas'
import { getSocios } from '../api/socios'
import AddCuotaModal from '../components/cuota/AddCuotaModal'
import AutomationStatus from '../components/cuota/AutomationStatus'
import BillingPhaseTracker from '../components/cuota/BillingPhaseTracker'
import DeleteCuotaModal from '../components/cuota/DeleteCuotaModal'
import EditCuotaModal from '../components/cuota/EditCuotaModal'
import GenerateCuotasModal from '../components/cuota/GenerateCuotasModal'
import PeriodKpis from '../components/cuota/PeriodKpis'
import PeriodSelector from '../components/cuota/PeriodSelector'
import SectionHeading from '../components/shared/SectionHeading'
import TaskRunLogModal from '../components/cuota/TaskRunLogModal'
import UnpaidCuotasTable from '../components/cuota/UnpaidCuotasTable'
import { isValidPeriod } from '../components/cuota/cuotaPeriod'
import PageHeader from '../components/shared/PageHeader'
import { currentPeriod } from '../components/shared/periodFormat'
import useAssignBenefit from '../hooks/useAssignBenefit'
import useCuotaPeriod from '../hooks/useCuotaPeriod'
import useRegisterPayment from '../hooks/useRegisterPayment'
import { collectErrorMessages, formatDni } from '../components/personas/format'

const FORMULARIO_INICIAL = {
  socio_id: '',
  periodo: '',
  fecha_venc1: '',
  fecha_venc2: '',
}

const SECTION_CLASS = 'p-4 sm:p-5'
const GENERATE_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-10 px-3 rounded bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2'

const esSocioActivo = (socio) => (socio.estado_administrativo_nombre ?? '').toLowerCase() === 'activo'

function Cuotas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPeriod = searchParams.get('periodo')
  const period = isValidPeriod(requestedPeriod) ? requestedPeriod : currentPeriod()
  const { summary, cuotas, runs, reload } = useCuotaPeriod(period)
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const [socios, setSocios] = useState([])
  const [modalAgregar, setModalAgregar] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)
  const [logRun, setLogRun] = useState(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [actionError, setActionError] = useState('')

  const changePeriod = (value) => setSearchParams({ periodo: value })

  const unpaidRows = useMemo(() => cuotas.data?.filter((row) => !row.paid) ?? null, [cuotas.data])

  const sociosOptions = useMemo(() => socios
    .filter(esSocioActivo)
    .map((socio) => ({
      value: String(socio.socio_id),
      label: `${socio.apellido}, ${socio.nombre} - DNI ${formatDni(socio.dni)}`,
    })), [socios])

  const abrirAgregar = () => {
    setFormulario({ ...FORMULARIO_INICIAL, periodo: period })
    setErrorFormulario('')
    setModalAgregar(true)
    if (socios.length === 0) {
      getSocios()
        .then((respuesta) => setSocios(respuesta ?? []))
        .catch(() => setErrorFormulario('No se pudieron cargar los socios.'))
    }
  }

  const abrirEditar = async (row) => {
    setActionError('')
    try {
      const cuota = await getCuota(row.cuota_id)
      setCuotaSeleccionada(cuota)
      setFormulario({
        socio_id: cuota.socio?.socio_id ?? '',
        periodo: cuota.periodo ?? '',
        fecha_venc1: cuota.fecha_venc1 ?? '',
        fecha_venc2: cuota.fecha_venc2 ?? '',
      })
      setErrorFormulario('')
      setModalEditar(true)
    } catch {
      setActionError('No se pudo abrir la cuota para editarla.')
    }
  }

  const abrirEliminar = (row) => {
    setCuotaSeleccionada(row)
    setErrorFormulario('')
    setModalEliminar(true)
  }

  const cerrarModal = () => {
    setModalAgregar(false)
    setModalEditar(false)
    setModalEliminar(false)
    setCuotaSeleccionada(null)
    setFormulario(FORMULARIO_INICIAL)
    setErrorFormulario('')
  }

  const guardarCuota = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setErrorFormulario('')

    try {
      if (modalEditar && cuotaSeleccionada) {
        if (!formulario.fecha_venc1 || !formulario.fecha_venc2) {
          throw new Error('Completá los campos obligatorios.')
        }
        await patchCuota(cuotaSeleccionada.cuota_id, {
          fecha_venc1: formulario.fecha_venc1,
          fecha_venc2: formulario.fecha_venc2,
        })
      } else {
        if (!formulario.socio_id || !formulario.periodo) {
          throw new Error('Completá los campos obligatorios.')
        }
        await postCuota({
          socio_id: Number(formulario.socio_id),
          periodo: formulario.periodo,
          ...(formulario.fecha_venc1 && { fecha_venc1: formulario.fecha_venc1 }),
          ...(formulario.fecha_venc2 && { fecha_venc2: formulario.fecha_venc2 }),
        })
      }

      cerrarModal()
      reload()
    } catch (requestError) {
      const data = requestError.response?.data
      const message = data && typeof data === 'object'
        ? collectErrorMessages(data).join(' ')
        : requestError.message
      setErrorFormulario(message || 'No se pudo guardar la cuota.')
    } finally {
      setGuardando(false)
    }
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
          <div className="flex flex-wrap items-center gap-2.5">
            <PeriodSelector value={period} onChange={changePeriod} />
            <button type="button" onClick={() => setGenerateOpen(true)} className={GENERATE_BUTTON_CLASS}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">request_quote</span>
              Generar cuotas
            </button>
          </div>
        )}
      />

      <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
        <div role="region" aria-labelledby="billing-phase-title">
          <SectionHeading id="billing-phase-title" icon="checklist_rtl" title="Etapa del mes" />
          <div className="px-4 sm:px-5 py-3">
            <BillingPhaseTracker phases={summary.data?.phases} isLoading={summary.isLoading} error={summary.error} />
          </div>
        </div>

        <div role="region" aria-labelledby="period-kpis-title">
          <SectionHeading id="period-kpis-title" icon="monitoring" title="Indicadores del período" />
          <div className={SECTION_CLASS}>
            <PeriodKpis
              summary={summary.data}
              rows={cuotas.data}
              isLoading={summary.isLoading || cuotas.isLoading}
              error={summary.error || cuotas.error}
            />
          </div>
        </div>

        <AutomationStatus runs={runs.data} isLoading={runs.isLoading} error={runs.error} onOpenLog={setLogRun} />

        <div role="region" aria-labelledby="unpaid-cuotas-title">
          <SectionHeading id="unpaid-cuotas-title" icon="pending_actions" title="Cuotas impagas al día de la fecha" />
          {actionError && (
            <p role="alert" className="mx-4 sm:mx-5 mt-4 text-sm text-error bg-error-container rounded px-3 py-2">{actionError}</p>
          )}
          <UnpaidCuotasTable
            key={period}
            rows={unpaidRows ?? []}
            isLoading={cuotas.isLoading}
            error={cuotas.error}
            period={period}
            onPay={(row) => openPayment({ socioId: row.socio_id, cuotaIds: [row.cuota_id], onSuccess: reload })}
            onAssignBenefit={(row) => openBenefit({ socioId: row.socio_id, cuotaId: row.cuota_id, onSuccess: reload })}
            onEdit={abrirEditar}
            onDelete={abrirEliminar}
            onChanged={reload}
          />
        </div>
      </div>

      <TaskRunLogModal run={logRun} onClose={() => setLogRun(null)} />

      <GenerateCuotasModal opened={generateOpen} onClose={() => setGenerateOpen(false)} onGenerated={reload} />

      <AddCuotaModal
        opened={modalAgregar}
        onClose={() => !guardando && cerrarModal()}
        onSubmit={guardarCuota}
        formulario={formulario}
        onChange={(campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }))}
        loading={guardando}
        error={errorFormulario}
        sociosOptions={sociosOptions}
      />

      <EditCuotaModal
        opened={modalEditar}
        onClose={() => !guardando && cerrarModal()}
        onSubmit={guardarCuota}
        formulario={formulario}
        onChange={(campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }))}
        loading={guardando}
        error={errorFormulario}
        cuota={cuotaSeleccionada}
      />

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