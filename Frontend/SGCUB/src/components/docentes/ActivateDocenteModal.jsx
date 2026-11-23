import { useState } from 'react'
import { Text } from '@mantine/core'
import PersonStatusModal from '../personas/PersonStatusModal'
import CargoFields from './CargoFields'
import { validateCargo } from './docentesUtils'

function ActivateDocenteModal({ opened, onClose, onConfirm, personName, needsCargo, cargos = [], categorias = [], loading, error }) {
  const [cargo, setCargo] = useState('')
  const [seleccionadas, setSeleccionadas] = useState([])

  return (
    <PersonStatusModal
      opened={opened}
      action="alta"
      title="Confirmar alta de docente"
      personName={personName}
      size={needsCargo ? 'lg' : 'md'}
      consequences={['La ficha vuelve a ser editable.']}
      validate={needsCargo ? () => validateCargo(cargo, seleccionadas) : undefined}
      onClose={onClose}
      onConfirm={() => onConfirm(needsCargo ? [{ cargo: Number(cargo), categorias: seleccionadas.map(Number) }] : undefined)}
      loading={loading}
      error={error}
    >
      {needsCargo && (
        <div className="flex flex-col gap-4">
          <Text size="md" mt="md">
            No tiene cargos asignados: para darlo de alta, asignale al menos un cargo con sus categorías.
          </Text>
          <CargoFields
            cargo={cargo}
            onCargoChange={setCargo}
            seleccionadas={seleccionadas}
            onSeleccionadasChange={setSeleccionadas}
            cargos={cargos}
            categorias={categorias}
            disabled={loading}
          />
        </div>
      )}
    </PersonStatusModal>
  )
}

export default ActivateDocenteModal
