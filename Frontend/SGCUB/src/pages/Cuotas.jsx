import { useEffect, useMemo, useState } from 'react'
import { deleteCuota, getCuotas, patchCuota, postCuota } from '../api/cuotas'
import { getSocios } from '../api/socios'
import AddCuotaModal from '../components/cuota/AddCuotaModal'
import CuotaTable from '../components/cuota/CuotaTable'
import DeleteCuotaModal from '../components/cuota/DeleteCuotaModal'
import EditCuotaModal from '../components/cuota/EditCuotaModal'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useAssignBenefit from '../hooks/useAssignBenefit'
import useRegisterPayment from '../hooks/useRegisterPayment'
import { collectErrorMessages } from '../components/personas/format'
import { CUOTA_STATES, countByState, isOverdue } from '../components/finanzas/cuotaStates'

const FORMULARIO_INICIAL = {
  socio_id: '',
  periodo: '',
  fecha_venc1: '',
  fecha_venc2: '',
}

const esSocioActivo = (socio) => (socio.estado_administrativo_nombre ?? '').toLowerCase() === 'activo'

function Cuotas() {
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const [cuotas, setCuotas] = useState([])
  const [socios, setSocios] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAgregar, setModalAgregar] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)

  const cargarDatos = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [respuestaCuotas, respuestaSocios] = await Promise.all([
        getCuotas(),
        getSocios(),
      ])
      setCuotas(respuestaCuotas ?? [])
      setSocios(respuestaSocios ?? [])
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'No se pudieron cargar las cuotas.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const sociosOptions = useMemo(() => socios
    .filter(esSocioActivo)
    .map((socio) => ({
      value: String(socio.socio_id),
      label: `${socio.apellido}, ${socio.nombre} - DNI ${socio.dni}`,
    })), [socios])

  const resumen = useMemo(() => {
    const total = cuotas.length
    const vencidas = cuotas.filter(isOverdue).length
    const pagas = countByState(cuotas, CUOTA_STATES.PAGA)

    return {
      total: total.toLocaleString('es-AR'),
      vencidas: vencidas.toLocaleString('es-AR'),
      pagas: pagas.toLocaleString('es-AR'),
    }
  }, [cuotas])

  const abrirAgregar = () => {
    setFormulario(FORMULARIO_INICIAL)
    setErrorFormulario('')
    setModalAgregar(true)
  }

  const abrirEditar = (cuota) => {
    setCuotaSeleccionada(cuota)
    setFormulario({
      socio_id: cuota.socio?.socio_id ?? '',
      periodo: cuota.periodo ?? '',
      fecha_venc1: cuota.fecha_venc1 ?? '',
      fecha_venc2: cuota.fecha_venc2 ?? '',
    })
    setErrorFormulario('')
    setModalEditar(true)
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
      await cargarDatos()
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
      await cargarDatos()
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
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <StatCard label="Total cuotas" value={resumen.total} icon="receipt" tone="neutral" />
        <StatCard label="Cuotas vencidas" value={resumen.vencidas} icon="warning" tone="warning" />
        <StatCard label="Cuotas pagas" value={resumen.pagas} icon="task_alt" tone="positive" />
      </div>

      <section aria-label="Cuotas">
        <CuotaTable
          data={cuotas}
          isLoading={isLoading}
          error={error}
          onAdd={abrirAgregar}
          onEdit={abrirEditar}
          onDelete={(cuota) => {
            setCuotaSeleccionada(cuota)
            setModalEliminar(true)
          }}
          onPay={(cuota) => openPayment({ socioId: cuota.socio.socio_id, cuotaIds: [cuota.cuota_id], onSuccess: cargarDatos })}
          onAssignBenefit={(cuota) => openBenefit({ socioId: cuota.socio.socio_id, cuotaId: cuota.cuota_id, onSuccess: cargarDatos })}
        />
      </section>

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
