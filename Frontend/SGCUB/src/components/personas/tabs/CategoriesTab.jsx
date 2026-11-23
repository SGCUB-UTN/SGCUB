import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import CargoFields from '../../docentes/CargoFields'
import CargosDocenteTable from '../../docentes/CargosDocenteTable'
import { etiquetaCategoria, idsCategorias, validateCargo } from '../../docentes/docentesUtils'
import { TabHeader, EmptyState, PrimaryButton } from './parts'

const aPayload = (asignaciones) => asignaciones.map((asignacion) => ({
  cargo: Number(asignacion.cargo),
  categorias: asignacion.categorias.map((categoria) => Number(categoria.categoria_id ?? categoria)),
}))

function CargoModal({ asignacion, asignaciones, cargos, categorias, onClose, onSave }) {
  const editando = Boolean(asignacion)
  const [cargo, setCargo] = useState(editando ? String(asignacion.cargo) : '')
  const [seleccionadas, setSeleccionadas] = useState(editando ? idsCategorias(asignacion) : [])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    const validationError = validateCargo(cargo, seleccionadas)
    if (validationError) return setError(validationError)
    setGuardando(true)
    setError('')
    const nueva = { cargo, categorias: seleccionadas }
    const resultado = editando
      ? asignaciones.map((a) => (a === asignacion ? nueva : a))
      : [...asignaciones, nueva]
    try {
      await onSave(resultado)
      onClose()
    } catch (saveError) {
      setError(saveError.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened
      onClose={() => !guardando && onClose()}
      centered
      size="lg"
      title={<Text fw={700} size="xl">{editando ? 'Editar cargo' : 'Agregar cargo'}</Text>}
    >
      <div className="flex flex-col gap-4">
        <CargoFields
          cargo={cargo}
          onCargoChange={setCargo}
          seleccionadas={seleccionadas}
          onSeleccionadasChange={setSeleccionadas}
          cargos={cargos}
          categorias={categorias}
          otherAssignments={asignaciones.filter((a) => a !== asignacion)}
          disabled={guardando}
        />

        {error && <Text color="red" size="base">{error}</Text>}

        <Group position="right" mt="sm">
          <Button variant="default" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>{editando ? 'Guardar cambios' : 'Agregar cargo'}</Button>
        </Group>
      </div>
    </Modal>
  )
}

function ConfirmRemoveCargoModal({ asignacion, onClose, onConfirm }) {
  const [error, setError] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)

  const handleConfirm = async () => {
    setIsRemoving(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (removeError) {
      setError(removeError.message)
      setIsRemoving(false)
    }
  }

  return (
    <Modal
      opened
      onClose={() => !isRemoving && onClose()}
      centered
      title={<Text fw={700} size="xl">¿Eliminar este cargo?</Text>}
    >
      <div className="p-3 bg-surface-container-low rounded-lg space-y-2">
        <p className="text-base font-semibold text-on-surface">{asignacion.cargo_nombre ?? 'Cargo sin nombre'}</p>
        <ul className="flex flex-wrap gap-1.5">
          {asignacion.categorias.map((categoria) => (
            <li key={categoria.categoria_id} className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-on-surface text-sm font-medium">
              {etiquetaCategoria(categoria)}
            </li>
          ))}
        </ul>
      </div>
      <Text size="md" mt="md">
        El docente dejará de tener este cargo en todas las categorías asociadas.
      </Text>
      {error && <Text color="red" size="sm" mt="md">{error}</Text>}
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={isRemoving}>Cancelar</Button>
        <Button color="red" onClick={handleConfirm} loading={isRemoving}>Eliminar cargo</Button>
      </Group>
    </Modal>
  )
}

export default function CategoriesTab({ asignaciones = [], cargos = [], categorias = [], editable = false, isActive = true, onSave }) {
  const [modalCargo, setModalCargo] = useState(null)
  const [cargoToRemove, setCargoToRemove] = useState(null)
  const removeDisabledReason = isActive && asignaciones.length === 1
    ? 'Un docente activo debe tener al menos un cargo'
    : undefined

  const guardar = (nuevas) => onSave(aPayload(nuevas))

  return (
    <div className="flex flex-col gap-6">
      <TabHeader
        title="Cargos y categorías"
        description="Cargos que ocupa el docente y las categorías en las que participa con cada uno"
        actions={editable && (
          <PrimaryButton icon="add" onClick={() => setModalCargo({ asignacion: null })}>Agregar cargo</PrimaryButton>
        )}
      />

      {asignaciones.length === 0 ? (
        <EmptyState
          icon="groups"
          title="Sin cargos asignados"
          description="Este docente todavía no tiene cargos ni categorías asignadas."
        />
      ) : (
        <CargosDocenteTable
          asignaciones={asignaciones}
          editable={editable}
          removeDisabledReason={removeDisabledReason}
          onEdit={(asignacion) => setModalCargo({ asignacion })}
          onRemove={setCargoToRemove}
        />
      )}

      {modalCargo && (
        <CargoModal
          asignacion={modalCargo.asignacion}
          asignaciones={asignaciones}
          cargos={cargos}
          categorias={categorias}
          onClose={() => setModalCargo(null)}
          onSave={guardar}
        />
      )}

      {cargoToRemove && (
        <ConfirmRemoveCargoModal
          asignacion={cargoToRemove}
          onClose={() => setCargoToRemove(null)}
          onConfirm={() => guardar(asignaciones.filter((asignacion) => asignacion !== cargoToRemove))}
        />
      )}
    </div>
  )
}
