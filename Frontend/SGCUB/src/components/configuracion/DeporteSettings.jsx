import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { deleteCargoDocente, getCargosDocente, patchCargoDocente, postCargoDocente } from '../../api/personasConfig'
import { deleteLiga, getLigas, patchLiga, postLiga } from '../../api/ligas'
import CategoriaFormModal from '../categorias/CategoriaFormModal'
import ConfirmCategoriaModal from '../categorias/ConfirmCategoriaModal'
import { formatRangoEdad, getGeneroLabel, getTipoLabel } from '../categorias/categoriaFormat'
import { getErrorMessage } from '../personas/format'
import { TableSkeletonRows } from '../shared/Skeleton'
import useCategorias from '../../hooks/useCategorias'
import { BUTTON_CLASSES, SMALL_BUTTON_CLASSES, TABLE_CLASSES } from './settingsForm'
import { Field, INPUT_CLASS, IconButton, Notice, SettingsSection } from './settingsParts'
import { ConfirmDeleteModal, InUseBadge, SubTabs } from './catalogParts'

const compareCategorias = (a, b) => (
  String(a.genero ?? '').localeCompare(String(b.genero ?? ''))
  || Number(a.edad_maxima ?? 0) - Number(b.edad_maxima ?? 0)
  || String(a.nombre).localeCompare(String(b.nombre), 'es')
)

function CategoriasSection() {
  const { categorias, isLoading, error, createCategoria, updateCategoria, deleteCategoria } = useCategorias()
  const [modalKey, setModalKey] = useState(0)
  const [form, setForm] = useState({ opened: false, categoria: null })
  const [removal, setRemoval] = useState({ opened: false, categoria: null })

  const openForm = (categoria = null) => {
    setModalKey((key) => key + 1)
    setForm({ opened: true, categoria })
  }
  const openRemoval = (categoria) => {
    setModalKey((key) => key + 1)
    setRemoval({ opened: true, categoria })
  }
  const handleSubmit = (data) => (form.categoria
    ? updateCategoria(form.categoria.categoria_id, data)
    : createCategoria(data))

  const sorted = [...categorias].sort(compareCategorias)

  return (
    <SettingsSection
      icon="sports_soccer"
      title="Categorías"
      description="Categorías en las que se distribuyen los jugadores, con su rango de edad y género."
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={() => openForm()}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nueva categoría
        </button>
      )}
    >
      {error && <div className="p-4"><Notice tone="error">{getErrorMessage(error, 'No se pudieron cargar las categorías.')}</Notice></div>}
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Categoría</th>
              <th className={TABLE_CLASSES.headCell}>Género</th>
              <th className={TABLE_CLASSES.headCell}>Edad</th>
              <th className={TABLE_CLASSES.headCell}>Año vigente</th>
              <th className={TABLE_CLASSES.headCell}>Tipo</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeletonRows colSpan={6} rows={4} cellClassName="py-4 px-6" label="Cargando categorías..." />
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay categorías registradas.</td></tr>
            ) : (
              sorted.map((categoria) => (
                <tr key={categoria.categoria_id} className={TABLE_CLASSES.row}>
                  <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>{categoria.nombre}</td>
                  <td className={TABLE_CLASSES.cell}>{getGeneroLabel(categoria.genero)}</td>
                  <td className={TABLE_CLASSES.cell}>{formatRangoEdad(categoria)}</td>
                  <td className={TABLE_CLASSES.cell}>{categoria.anio_vigente ?? '—'}</td>
                  <td className={TABLE_CLASSES.cell}>{getTipoLabel(categoria.tipo)}</td>
                  <td className={TABLE_CLASSES.actionsCell}>
                    <div className="flex justify-end gap-1">
                      <IconButton icon="edit" label="Editar" onClick={() => openForm(categoria)} />
                      <IconButton icon="delete" label="Eliminar" onClick={() => openRemoval(categoria)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CategoriaFormModal
        key={`form-${modalKey}`}
        opened={form.opened}
        onClose={() => setForm((current) => ({ ...current, opened: false }))}
        onSubmit={handleSubmit}
        categoria={form.categoria}
      />
      <ConfirmCategoriaModal
        key={`delete-${modalKey}`}
        opened={removal.opened}
        onClose={() => setRemoval((current) => ({ ...current, opened: false }))}
        onConfirm={() => deleteCategoria(removal.categoria.categoria_id)}
        categoria={removal.categoria}
      />
    </SettingsSection>
  )
}

function LigasSection() {
  const [ligas, setLigas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ opened: false, item: null })
  const [nombre, setNombre] = useState('')
  const [abreviatura, setAbreviatura] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ opened: false, item: null })

  const load = async () => {
    setLoading(true)
    try {
      setLigas(await getLigas())
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar las ligas.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setModal({ opened: true, item: null })
    setNombre('')
    setAbreviatura('')
    setFormError('')
  }
  const openEdit = (item) => {
    setModal({ opened: true, item })
    setNombre(item.nombre)
    setAbreviatura(item.abreviatura ?? '')
    setFormError('')
  }
  const handleSave = async (e) => {
    e.preventDefault()
    if (!nombre.trim() || !abreviatura.trim()) {
      setFormError('El nombre y la abreviatura son obligatorios.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const data = { nombre: nombre.trim(), abreviatura: abreviatura.trim() }
      if (modal.item) {
        await patchLiga(modal.item.liga_id, data)
      } else {
        await postLiga(data)
      }
      setModal({ opened: false, item: null })
      await load()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la liga.'))
    } finally {
      setSaving(false)
    }
  }
  const handleDelete = async () => {
    if (!deleteModal.item) return
    await deleteLiga(deleteModal.item.liga_id)
    await load()
  }

  return (
    <SettingsSection
      icon="emoji_events"
      title="Ligas"
      description="Ligas en las que se pueden registrar los jugadores del club."
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nueva liga
        </button>
      )}
    >
      {error && <div className="p-4"><Notice tone="error">{error}</Notice></div>}
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Liga</th>
              <th className={TABLE_CLASSES.headCell}>Abreviatura</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows colSpan={4} rows={3} cellClassName="py-4 px-6" label="Cargando ligas..." />
            ) : ligas.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay ligas registradas.</td></tr>
            ) : (
              ligas.map((liga) => (
                <tr key={liga.liga_id} className={TABLE_CLASSES.row}>
                  <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>{liga.nombre}</td>
                  <td className={TABLE_CLASSES.cell}>{liga.abreviatura}</td>
                  <td className={TABLE_CLASSES.cell}><InUseBadge inUse={liga.en_uso} /></td>
                  <td className={TABLE_CLASSES.actionsCell}>
                    <div className="flex justify-end gap-1">
                      <IconButton icon="edit" label="Editar" onClick={() => openEdit(liga)} />
                      <IconButton
                        icon="delete"
                        label={liga.en_uso ? 'Tiene jugadores registrados' : 'Eliminar'}
                        disabled={liga.en_uso}
                        onClick={() => setDeleteModal({ opened: true, item: liga })}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        opened={modal.opened}
        onClose={() => !saving && setModal({ opened: false, item: null })}
        centered
        title={<Text fw={700} size="xl">{modal.item ? 'Editar liga' : 'Nueva liga'}</Text>}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Field label="Nombre de la liga" htmlFor="liga-nombre" error={formError}>
            <input
              id="liga-nombre"
              className={INPUT_CLASS}
              value={nombre}
              maxLength={100}
              placeholder="Ej: Liga Platense"
              onChange={(e) => setNombre(e.target.value)}
              required
              data-autofocus
            />
          </Field>
          <Field label="Abreviatura" htmlFor="liga-abreviatura" hint="Se muestra en la ficha del jugador y donde hay poco espacio.">
            <input
              id="liga-abreviatura"
              className={`${INPUT_CLASS} uppercase`}
              value={abreviatura}
              maxLength={10}
              placeholder="Ej: LP"
              onChange={(e) => setAbreviatura(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className={BUTTON_CLASSES.secondary} onClick={() => setModal({ opened: false, item: null })} disabled={saving}>Cancelar</button>
            <button type="submit" className={BUTTON_CLASSES.primary} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, item: null })}
        onConfirm={handleDelete}
        title="¿Eliminar liga?"
        message={`¿Estás seguro de que querés eliminar "${deleteModal.item?.nombre}"?`}
      />
    </SettingsSection>
  )
}

function CargosDocentesSection() {
  const [cargos, setCargos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ opened: false, cargo: null })
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ opened: false, cargo: null })

  const load = async () => {
    setLoading(true)
    try {
      setCargos(await getCargosDocente())
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los cargos docentes.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setModal({ opened: true, cargo: null })
    setNombre('')
    setFormError('')
  }

  const openEdit = (cargo) => {
    setModal({ opened: true, cargo })
    setNombre(cargo.nombre)
    setFormError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (modal.cargo) {
        await patchCargoDocente(modal.cargo.cargo_id, { nombre: nombre.trim() })
      } else {
        await postCargoDocente({ nombre: nombre.trim() })
      }
      setModal({ opened: false, cargo: null })
      await load()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el cargo.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.cargo) return
    await deleteCargoDocente(deleteModal.cargo.cargo_id)
    await load()
  }

  return (
    <SettingsSection
      icon="school"
      title="Cargos de docentes"
      description="Configurá los diferentes roles o cargos que pueden desempeñar los profesores y formadores (Director Técnico, Ayudante, Preparador Físico, etc.)."
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nuevo cargo
        </button>
      )}
    >
      {error && <div className="p-4"><Notice tone="error">{error}</Notice></div>}
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Nombre del cargo</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows colSpan={3} rows={3} cellClassName="py-4 px-6" label="Cargando cargos..." />
            ) : cargos.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay cargos cargados.</td></tr>
            ) : (
              cargos.map((cargo) => (
                <tr key={cargo.cargo_id} className={TABLE_CLASSES.row}>
                  <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>{cargo.nombre}</td>
                  <td className={TABLE_CLASSES.cell}><InUseBadge inUse={cargo.en_uso} /></td>
                  <td className={TABLE_CLASSES.actionsCell}>
                    <div className="flex justify-end gap-1">
                      <IconButton icon="edit" label="Editar" onClick={() => openEdit(cargo)} />
                      <IconButton
                        icon="delete"
                        label={cargo.en_uso ? 'Está asignado a docentes: no se puede eliminar' : 'Eliminar'}
                        disabled={cargo.en_uso}
                        onClick={() => setDeleteModal({ opened: true, cargo })}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        opened={modal.opened}
        onClose={() => !saving && setModal({ opened: false, cargo: null })}
        centered
        title={<Text fw={700} size="xl">{modal.cargo ? 'Editar cargo docente' : 'Nuevo cargo docente'}</Text>}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Field label="Nombre del cargo" htmlFor="cargo-nombre" error={formError}>
            <input
              id="cargo-nombre"
              className={INPUT_CLASS}
              value={nombre}
              maxLength={100}
              placeholder="Ej: Director Técnico"
              onChange={(e) => setNombre(e.target.value)}
              required
              data-autofocus
            />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className={BUTTON_CLASSES.secondary} onClick={() => setModal({ opened: false, cargo: null })} disabled={saving}>Cancelar</button>
            <button type="submit" className={BUTTON_CLASSES.primary} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, cargo: null })}
        onConfirm={handleDelete}
        title="¿Eliminar cargo docente?"
        message={`¿Estás seguro de que querés eliminar el cargo "${deleteModal.cargo?.nombre}"?`}
      />
    </SettingsSection>
  )
}

const SUBTABS = [
  { id: 'categorias', label: 'Categorías', icon: 'sports_soccer' },
  { id: 'ligas', label: 'Ligas', icon: 'emoji_events' },
  { id: 'cargos', label: 'Cargos docentes', icon: 'school' },
]

export default function DeporteSettings() {
  const [activeSubTab, setActiveSubTab] = useState(SUBTABS[0].id)

  return (
    <div className="flex flex-col gap-6">
      <SubTabs tabs={SUBTABS} active={activeSubTab} onChange={setActiveSubTab} />
      {activeSubTab === 'categorias' && <CategoriasSection />}
      {activeSubTab === 'ligas' && <LigasSection />}
      {activeSubTab === 'cargos' && <CargosDocentesSection />}
    </div>
  )
}
