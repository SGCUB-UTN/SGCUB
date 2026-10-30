import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteCategoria, getCategoria, patchCategoria } from '../api/categorias'
import { deleteDocenteCategoria, docenteCategoriaByCategoria } from '../api/docenteCategoria'
import { getCargosDocente } from '../api/docentes'
import { getJugadoresByCategoria } from '../api/jugadores'
import AssignDocenteModal from '../components/categorias/AssignDocenteModal'
import CategoriaDocenteTable from '../components/categorias/CategoriaDocenteTable'
import CategoriaEmptyState from '../components/categorias/CategoriaEmptyState'
import CategoriaFormModal from '../components/categorias/CategoriaFormModal'
import CategoriaHeader from '../components/categorias/CategoriaHeader'
import CategoriaJugadoresTable from '../components/categorias/CategoriaJugadoresTable'
import ConfirmCategoriaModal from '../components/categorias/ConfirmCategoriaModal'
import ConfirmRemoveDocenteModal from '../components/categorias/ConfirmRemoveDocenteModal'
import { formatRangoEdad, GENERO_BADGE_CLASSES, getGeneroLabel, getTipoLabel } from '../components/categorias/categoriaFormat'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { DeactivateButton, EditButton } from '../components/personas/HeaderPersona'
import { PrimaryButton, TabHeader } from '../components/personas/tabs/parts'
import { getErrorMessage } from '../components/personas/format'
import useCategorias from '../hooks/useCategorias'
import useDocentes from '../hooks/useDocentes'
import UnderlineTabs from '../components/shared/UnderlineTabs'

const PANEL_ID = 'categoria-tab-panel'

const fetchDetail = (id) => Promise.all([
  getCategoria(id),
  docenteCategoriaByCategoria(id),
  getJugadoresByCategoria(id).catch(() => null),
])

const ErrorAlert = ({ message }) => (
  <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-center gap-2.5" role="alert">
    <span className="material-symbols-outlined text-error">error</span>
    <p className="text-base font-medium">{message}</p>
  </div>
)

function CategoriaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { docentes, editarDocente, recargarDocentes } = useDocentes()
  const { categorias } = useCategorias()
  const [cargos, setCargos] = useState([])

  const [detail, setDetail] = useState({ id: null, categoria: null, docenteCategorias: [], jugadores: null, error: null })
  const isLoading = detail.id !== id
  const { categoria, docenteCategorias, jugadores, error } = detail

  const [modalKey, setModalKey] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeletionOpen, setIsDeletionOpen] = useState(false)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [removal, setRemoval] = useState({ opened: false, docenteCategoria: null })
  const [activeTab, setActiveTab] = useState('integrantes')

  useEffect(() => {
    let active = true
    fetchDetail(id)
      .then(([receivedCategoria, receivedDocenteCategorias, receivedJugadores]) => {
        if (active) {
          setDetail({
            id,
            categoria: receivedCategoria,
            docenteCategorias: receivedDocenteCategorias,
            jugadores: receivedJugadores,
            error: null,
          })
        }
      })
      .catch((requestError) => {
        if (active) {
          setDetail({
            id,
            categoria: null,
            docenteCategorias: [],
            jugadores: null,
            error: getErrorMessage(requestError, 'No se pudo cargar la información de la categoría.'),
          })
        }
      })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    let active = true
    getCargosDocente()
      .then((receivedCargos) => active && setCargos(receivedCargos))
      .catch(() => active && setCargos([]))
    return () => { active = false }
  }, [])

  const openModal = (setOpened) => {
    setModalKey((key) => key + 1)
    setOpened(true)
  }

  const reloadDocenteCategorias = async () => {
    const receivedDocenteCategorias = await docenteCategoriaByCategoria(id)
    setDetail((current) => ({ ...current, docenteCategorias: receivedDocenteCategorias }))
  }

  const handleUpdate = async (data) => {
    const updated = await patchCategoria(categoria.categoria_id, data)
    setDetail((current) => ({ ...current, categoria: updated }))
  }

  const handleDelete = async () => {
    await deleteCategoria(categoria.categoria_id)
    navigate('/padron/categorias')
  }

  const openRemoval = (docenteCategoria) => {
    setModalKey((key) => key + 1)
    setRemoval({ opened: true, docenteCategoria })
  }

  const handleAssignDocente = async (docente, asignaciones) => {
    await editarDocente(docente.docente_id, { asignaciones })
    await reloadDocenteCategorias()
  }

  const handleRemoveDocente = async () => {
    await deleteDocenteCategoria(removal.docenteCategoria.docente_categoria_id)
    await Promise.all([reloadDocenteCategorias(), recargarDocentes()])
  }

  if (isLoading) return <LoadingFile text="Cargando detalle de la categoría..." />
  if (error || !categoria) {
    return (
      <ErrorFile
        message={error || 'La categoría solicitada no existe.'}
        backTo="/padron/categorias"
        backText="Volver a categorías"
      />
    )
  }

  const tabs = [
    {
      value: 'integrantes',
      id: 'categoria-tab-integrantes',
      label: 'Integrantes',
      icon: 'groups',
      count: (jugadores?.length ?? 0) + docenteCategorias.length,
      content: (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 min-w-0">
            <TabHeader
              title="Jugadores"
              description={`Total asignado a esta categoría: ${jugadores?.length ?? 0}`}
            />
            {!jugadores && <ErrorAlert message="No se pudieron cargar los jugadores de la categoría." />}
            {jugadores?.length === 0 && (
              <CategoriaEmptyState icon="groups" title="Sin jugadores" description="Todavía no hay jugadores en esta categoría." />
            )}
            {jugadores?.length > 0 && <CategoriaJugadoresTable jugadores={jugadores} categoriaId={categoria.categoria_id} />}
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <TabHeader
              title="Docentes"
              description={`Total asignado a esta categoría: ${docenteCategorias.length}`}
              actions={(
                <PrimaryButton icon="person_add" onClick={() => openModal(setIsAssignOpen)}>
                  Asignar docente
                </PrimaryButton>
              )}
            />
            {docenteCategorias.length === 0 ? (
              <CategoriaEmptyState icon="school" title="Sin docentes" description="Todavía no hay docentes asignados a esta categoría." />
            ) : (
              <CategoriaDocenteTable docenteCategorias={docenteCategorias} onRemove={openRemoval} />
            )}
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      <CategoriaHeader
        breadcrumb={[
          { label: 'Categorías', to: '/padron/categorias' },
          { label: categoria.nombre },
        ]}
        title={categoria.nombre}
        badge={GENERO_BADGE_CLASSES[categoria.genero] && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${GENERO_BADGE_CLASSES[categoria.genero]}`}>
            {getGeneroLabel(categoria.genero)}
          </span>
        )}
        metadata={[
          { label: 'Año vigente', value: categoria.anio_vigente ?? '—' },
          { label: 'Edad', value: formatRangoEdad(categoria) },
          { label: 'Género', value: getGeneroLabel(categoria.genero) },
          { label: 'Tipo', value: getTipoLabel(categoria.tipo) },
        ]}
        actions={(
          <>
            <EditButton onClick={() => openModal(setIsFormOpen)}>Editar categoría</EditButton>
            <DeactivateButton icon="delete" onClick={() => openModal(setIsDeletionOpen)}>Eliminar</DeactivateButton>
          </>
        )}
      />

      <UnderlineTabs
        label="Secciones de la categoría"
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        panelId={PANEL_ID}
        className="mb-6"
      />
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabs.find((tab) => tab.value === activeTab).id}>
        {tabs.find((tab) => tab.value === activeTab).content}
      </div>

      <CategoriaFormModal
        key={`form-${modalKey}`}
        opened={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleUpdate}
        categoria={categoria}
      />

      <ConfirmCategoriaModal
        key={`delete-${modalKey}`}
        opened={isDeletionOpen}
        onClose={() => setIsDeletionOpen(false)}
        onConfirm={handleDelete}
        categoria={categoria}
      />

      <AssignDocenteModal
        key={`assign-${modalKey}`}
        opened={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onSubmit={handleAssignDocente}
        categoria={categoria}
        docentes={docentes}
        cargos={cargos}
        categorias={categorias}
        assignedDocenteIds={docenteCategorias.map((docenteCategoria) => docenteCategoria.docente?.docente_id)}
      />

      <ConfirmRemoveDocenteModal
        key={`remove-${modalKey}`}
        opened={removal.opened}
        onClose={() => setRemoval((current) => ({ ...current, opened: false }))}
        onConfirm={handleRemoveDocente}
        docenteCategoria={removal.docenteCategoria}
        categoria={categoria}
      />
    </div>
  )
}

export default CategoriaDetail
