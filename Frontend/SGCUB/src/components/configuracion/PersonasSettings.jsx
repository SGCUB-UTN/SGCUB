import { useEffect, useMemo, useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import {
  getCargosDocente,
  postCargoDocente,
  patchCargoDocente,
  deleteCargoDocente,
  getLocalidades,
  postLocalidad,
  patchLocalidad,
  deleteLocalidad,
  getBarrios,
  postBarrio,
  patchBarrio,
  deleteBarrio,
  getTiposRelacionFamiliar,
  postTipoRelacionFamiliar,
  patchTipoRelacionFamiliar,
  deleteTipoRelacionFamiliar,
  getObrasSociales,
  postObraSocial,
  patchObraSocial,
  deleteObraSocial,
  getTallesIndumentaria,
  postTalleIndumentaria,
  patchTalleIndumentaria,
  deleteTalleIndumentaria,
} from '../../api/personasConfig'
import { getErrorMessage } from '../personas/format'
import { BUTTON_CLASSES, SMALL_BUTTON_CLASSES, TABLE_CLASSES } from './settingsForm'
import { Field, INPUT_CLASS, IconButton, Notice, SelectInput, SettingsSection } from './settingsParts'

export const talleSortKey = (nombre) => {
  const name = (nombre || '').trim().toUpperCase()
  if (/^\d+$/.test(name)) {
    return [0, parseInt(name, 10), '']
  }
  const letterRanks = {
    XXXS: 1, XXS: 2, XS: 3, S: 4, M: 5, L: 6,
    XL: 7, XXL: 8, '2XL': 8, XXXL: 9, '3XL': 9, '4XL': 10,
  }
  if (letterRanks[name]) {
    return [1, letterRanks[name], '']
  }
  return [2, 0, name]
}

export const compareTalles = (a, b) => {
  const nameA = typeof a === 'string' ? a : a?.nombre || a?.valor || ''
  const nameB = typeof b === 'string' ? b : b?.nombre || b?.valor || ''
  const [typeA, valA, strA] = talleSortKey(nameA)
  const [typeB, valB, strB] = talleSortKey(nameB)
  if (typeA !== typeB) return typeA - typeB
  if (valA !== valB) return valA - valB
  return strA.localeCompare(strB, 'es')
}

export const compareObrasSociales = (a, b) => {
  const nameA = typeof a === 'string' ? a : a?.nombre || ''
  const nameB = typeof b === 'string' ? b : b?.nombre || ''
  const aSin = nameA.trim().toLowerCase() === 'sin obra social'
  const bSin = nameB.trim().toLowerCase() === 'sin obra social'
  if (aSin && !bSin) return -1
  if (!aSin && bSin) return 1
  return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
}

function InUseBadge({ inUse }) {
  if (!inUse) return <span className="text-xs text-on-surface-variant font-normal">—</span>
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      <span className="material-symbols-outlined text-[14px] text-slate-500" aria-hidden="true">check</span>
      En uso
    </span>
  )
}

function ConfirmDeleteModal({ opened, onClose, onConfirm, title, message }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo eliminar el elemento.'))
      setDeleting(false)
    }
  }

  return (
    <Modal opened={opened} onClose={() => !deleting && onClose()} centered title={<Text fw={700} size="xl">{title}</Text>}>
      <p className="text-base text-on-surface-variant mb-4">{message}</p>
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <Group position="right">
        <Button variant="default" onClick={onClose} disabled={deleting}>Cancelar</Button>
        <Button color="red" onClick={handleConfirm} loading={deleting}>Eliminar</Button>
      </Group>
    </Modal>
  )
}

// ----------------------------------------------------
// SECCIÓN 1: CARGOS DOCENTES
// ----------------------------------------------------
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
              <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-on-surface-variant">Cargando cargos...</td></tr>
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

// ----------------------------------------------------
// SECCIÓN 2: LOCALIDADES Y BARRIOS
// ----------------------------------------------------
function GeografiaSection() {
  const [localidades, setLocalidades] = useState([])
  const [barrios, setBarrios] = useState([])
  const [selectedLocalidad, setSelectedLocalidad] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Localidad modal
  const [locModal, setLocModal] = useState({ opened: false, loc: null })
  const [locNombre, setLocNombre] = useState('')
  const [locCP, setLocCP] = useState('')
  const [locSaving, setLocSaving] = useState(false)
  const [locError, setLocError] = useState('')
  const [deleteLocModal, setDeleteLocModal] = useState({ opened: false, loc: null })

  // Barrio modal
  const [barrioModal, setBarrioModal] = useState({ opened: false, barrio: null })
  const [barrioNombre, setBarrioNombre] = useState('')
  const [barrioLocalidad, setBarrioLocalidad] = useState('')
  const [barrioSaving, setBarrioSaving] = useState(false)
  const [barrioError, setBarrioError] = useState('')
  const [deleteBarrioModal, setDeleteBarrioModal] = useState({ opened: false, barrio: null })

  const loadData = async () => {
    setLoading(true)
    try {
      const [locs, bars] = await Promise.all([getLocalidades(), getBarrios()])
      setLocalidades(locs)
      setBarrios(bars)
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar localidades y barrios.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Localidad actions
  const openCreateLoc = () => {
    setLocModal({ opened: true, loc: null })
    setLocNombre('')
    setLocCP('')
    setLocError('')
  }
  const openEditLoc = (loc) => {
    setLocModal({ opened: true, loc })
    setLocNombre(loc.nombre)
    setLocCP(loc.codigo_postal || '')
    setLocError('')
  }
  const handleSaveLoc = async (e) => {
    e.preventDefault()
    if (!locNombre.trim()) {
      setLocError('El nombre es obligatorio.')
      return
    }
    setLocSaving(true)
    setLocError('')
    try {
      if (locModal.loc) {
        await patchLocalidad(locModal.loc.localidad_id, { nombre: locNombre.trim(), codigo_postal: locCP.trim() || null })
      } else {
        await postLocalidad({ nombre: locNombre.trim(), codigo_postal: locCP.trim() || null })
      }
      setLocModal({ opened: false, loc: null })
      await loadData()
    } catch (err) {
      setLocError(getErrorMessage(err, 'No se pudo guardar la localidad.'))
    } finally {
      setLocSaving(false)
    }
  }
  const handleDeleteLoc = async () => {
    if (!deleteLocModal.loc) return
    await deleteLocalidad(deleteLocModal.loc.localidad_id)
    await loadData()
  }

  // Barrio actions
  const openCreateBarrio = () => {
    setBarrioModal({ opened: true, barrio: null })
    setBarrioNombre('')
    setBarrioLocalidad(selectedLocalidad || (localidades[0]?.localidad_id ? String(localidades[0].localidad_id) : ''))
    setBarrioError('')
  }
  const openEditBarrio = (barrio) => {
    setBarrioModal({ opened: true, barrio })
    setBarrioNombre(barrio.nombre)
    setBarrioLocalidad(String(barrio.localidad))
    setBarrioError('')
  }
  const handleSaveBarrio = async (e) => {
    e.preventDefault()
    if (!barrioNombre.trim() || !barrioLocalidad) {
      setBarrioError('El nombre y la localidad son obligatorios.')
      return
    }
    setBarrioSaving(true)
    setBarrioError('')
    try {
      if (barrioModal.barrio) {
        await patchBarrio(barrioModal.barrio.barrio_id, { nombre: barrioNombre.trim(), localidad: Number(barrioLocalidad) })
      } else {
        await postBarrio({ nombre: barrioNombre.trim(), localidad: Number(barrioLocalidad) })
      }
      setBarrioModal({ opened: false, barrio: null })
      await loadData()
    } catch (err) {
      setBarrioError(getErrorMessage(err, 'No se pudo guardar el barrio.'))
    } finally {
      setBarrioSaving(false)
    }
  }
  const handleDeleteBarrio = async () => {
    if (!deleteBarrioModal.barrio) return
    await deleteBarrio(deleteBarrioModal.barrio.barrio_id)
    await loadData()
  }

  const filteredBarrios = selectedLocalidad
    ? barrios.filter((b) => String(b.localidad) === selectedLocalidad)
    : barrios

  return (
    <div className="flex flex-col gap-8">
      {/* LOCALIDADES */}
      <SettingsSection
        icon="location_city"
        title="Localidades"
        description="Ciudades o partidos donde residen socios, jugadores y docentes."
        flush
        extra={(
          <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreateLoc}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            Nueva localidad
          </button>
        )}
      >
        {error && <div className="p-4"><Notice tone="error">{error}</Notice></div>}
        <div className={TABLE_CLASSES.wrapper}>
          <table className={TABLE_CLASSES.table}>
            <thead className={TABLE_CLASSES.head}>
              <tr>
                <th className={TABLE_CLASSES.headCell}>Localidad</th>
                <th className={TABLE_CLASSES.headCell}>Código Postal</th>
                <th className={TABLE_CLASSES.headCell}>Estado</th>
                <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">Cargando...</td></tr>
              ) : localidades.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay localidades.</td></tr>
              ) : (
                localidades.map((loc) => (
                  <tr key={loc.localidad_id} className={TABLE_CLASSES.row}>
                    <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>{loc.nombre}</td>
                    <td className={`${TABLE_CLASSES.cell} text-on-surface-variant`}>{loc.codigo_postal || '—'}</td>
                    <td className={TABLE_CLASSES.cell}><InUseBadge inUse={loc.en_uso} /></td>
                    <td className={TABLE_CLASSES.actionsCell}>
                      <div className="flex justify-end gap-1">
                        <IconButton icon="edit" label="Editar" onClick={() => openEditLoc(loc)} />
                        <IconButton
                          icon="delete"
                          label={loc.en_uso ? 'Tiene barrios o domicilios asociados' : 'Eliminar'}
                          disabled={loc.en_uso}
                          onClick={() => setDeleteLocModal({ opened: true, loc })}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      {/* BARRIOS */}
      <SettingsSection
        icon="holiday_village"
        title="Barrios"
        description="Barrios asociados a cada localidad para una carga más precisa del domicilio."
        flush
        extra={(
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <SelectInput
                compact
                value={selectedLocalidad}
                onChange={(e) => setSelectedLocalidad(e.target.value)}
                aria-label="Filtrar por localidad"
              >
                <option value="">Todas las localidades</option>
                {localidades.map((loc) => (
                  <option key={loc.localidad_id} value={String(loc.localidad_id)}>{loc.nombre}</option>
                ))}
              </SelectInput>
            </div>
            <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreateBarrio} disabled={localidades.length === 0}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              Nuevo barrio
            </button>
          </div>
        )}
      >
        <div className={TABLE_CLASSES.wrapper}>
          <table className={TABLE_CLASSES.table}>
            <thead className={TABLE_CLASSES.head}>
              <tr>
                <th className={TABLE_CLASSES.headCell}>Barrio</th>
                <th className={TABLE_CLASSES.headCell}>Localidad</th>
                <th className={TABLE_CLASSES.headCell}>Estado</th>
                <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">Cargando...</td></tr>
              ) : filteredBarrios.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">No se encontraron barrios.</td></tr>
              ) : (
                filteredBarrios.map((barrio) => (
                  <tr key={barrio.barrio_id} className={TABLE_CLASSES.row}>
                    <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>{barrio.nombre}</td>
                    <td className={`${TABLE_CLASSES.cell} text-on-surface-variant`}>{barrio.localidad_nombre || '—'}</td>
                    <td className={TABLE_CLASSES.cell}><InUseBadge inUse={barrio.en_uso} /></td>
                    <td className={TABLE_CLASSES.actionsCell}>
                      <div className="flex justify-end gap-1">
                        <IconButton icon="edit" label="Editar" onClick={() => openEditBarrio(barrio)} />
                        <IconButton
                          icon="delete"
                          label={barrio.en_uso ? 'Tiene domicilios asociados' : 'Eliminar'}
                          disabled={barrio.en_uso}
                          onClick={() => setDeleteBarrioModal({ opened: true, barrio })}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      {/* MODAL LOCALIDAD */}
      <Modal
        opened={locModal.opened}
        onClose={() => !locSaving && setLocModal({ opened: false, loc: null })}
        centered
        title={<Text fw={700} size="xl">{locModal.loc ? 'Editar localidad' : 'Nueva localidad'}</Text>}
      >
        <form onSubmit={handleSaveLoc} className="flex flex-col gap-4">
          <Field label="Nombre de la localidad" htmlFor="loc-nombre" error={locError}>
            <input
              id="loc-nombre"
              className={INPUT_CLASS}
              value={locNombre}
              maxLength={100}
              placeholder="Ej: Tolosa"
              onChange={(e) => setLocNombre(e.target.value)}
              required
              data-autofocus
            />
          </Field>
          <Field label="Código postal (opcional)" htmlFor="loc-cp">
            <input
              id="loc-cp"
              className={INPUT_CLASS}
              value={locCP}
              maxLength={20}
              placeholder="Ej: 1900"
              onChange={(e) => setLocCP(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className={BUTTON_CLASSES.secondary} onClick={() => setLocModal({ opened: false, loc: null })} disabled={locSaving}>Cancelar</button>
            <button type="submit" className={BUTTON_CLASSES.primary} disabled={locSaving}>{locSaving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* MODAL BARRIO */}
      <Modal
        opened={barrioModal.opened}
        onClose={() => !barrioSaving && setBarrioModal({ opened: false, barrio: null })}
        centered
        title={<Text fw={700} size="xl">{barrioModal.barrio ? 'Editar barrio' : 'Nuevo barrio'}</Text>}
      >
        <form onSubmit={handleSaveBarrio} className="flex flex-col gap-4">
          <Field label="Nombre del barrio" htmlFor="barrio-nombre" error={barrioError}>
            <input
              id="barrio-nombre"
              className={INPUT_CLASS}
              value={barrioNombre}
              maxLength={100}
              placeholder="Ej: Barrio Norte"
              onChange={(e) => setBarrioNombre(e.target.value)}
              required
              data-autofocus
            />
          </Field>
          <Field label="Localidad" htmlFor="barrio-localidad">
            <SelectInput
              id="barrio-localidad"
              value={barrioLocalidad}
              onChange={(e) => setBarrioLocalidad(e.target.value)}
              required
            >
              <option value="" disabled>Seleccione localidad...</option>
              {localidades.map((loc) => (
                <option key={loc.localidad_id} value={String(loc.localidad_id)}>{loc.nombre}</option>
              ))}
            </SelectInput>
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className={BUTTON_CLASSES.secondary} onClick={() => setBarrioModal({ opened: false, barrio: null })} disabled={barrioSaving}>Cancelar</button>
            <button type="submit" className={BUTTON_CLASSES.primary} disabled={barrioSaving}>{barrioSaving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        opened={deleteLocModal.opened}
        onClose={() => setDeleteLocModal({ opened: false, loc: null })}
        onConfirm={handleDeleteLoc}
        title="¿Eliminar localidad?"
        message={`¿Estás seguro de que querés eliminar "${deleteLocModal.loc?.nombre}"?`}
      />

      <ConfirmDeleteModal
        opened={deleteBarrioModal.opened}
        onClose={() => setDeleteBarrioModal({ opened: false, barrio: null })}
        onConfirm={handleDeleteBarrio}
        title="¿Eliminar barrio?"
        message={`¿Estás seguro de que querés eliminar el barrio "${deleteBarrioModal.barrio?.nombre}"?`}
      />
    </div>
  )
}

// ----------------------------------------------------
// SECCIÓN 3: RELACIONES FAMILIARES
// ----------------------------------------------------
function RelacionesSection() {
  const [relaciones, setRelaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ opened: false, item: null })
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ opened: false, item: null })

  const load = async () => {
    setLoading(true)
    try {
      setRelaciones(await getTiposRelacionFamiliar())
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar las relaciones familiares.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setModal({ opened: true, item: null })
    setNombre('')
    setFormError('')
  }
  const openEdit = (item) => {
    setModal({ opened: true, item })
    setNombre(item.nombre)
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
      if (modal.item) {
        await patchTipoRelacionFamiliar(modal.item.tipo_relacion_id, { nombre: nombre.trim() })
      } else {
        await postTipoRelacionFamiliar({ nombre: nombre.trim() })
      }
      setModal({ opened: false, item: null })
      await load()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la relación.'))
    } finally {
      setSaving(false)
    }
  }
  const handleDelete = async () => {
    if (!deleteModal.item) return
    await deleteTipoRelacionFamiliar(deleteModal.item.tipo_relacion_id)
    await load()
  }

  const sortedRelaciones = useMemo(() => {
    return [...relaciones].sort((a, b) => {
      const isOtroA = a.nombre.trim().toLowerCase() === 'otro'
      const isOtroB = b.nombre.trim().toLowerCase() === 'otro'
      if (isOtroA && !isOtroB) return 1
      if (!isOtroA && isOtroB) return -1
      return a.nombre.localeCompare(b.nombre, 'es')
    })
  }, [relaciones])

  return (
    <SettingsSection
      icon="diversity_1"
      title="Relaciones y vínculos familiares"
      description="Tipos de vínculo o parentesco disponibles para los contactos de emergencia y responsables de jugadores y docentes."
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nueva relación
        </button>
      )}
    >
      {error && <div className="p-4"><Notice tone="error">{error}</Notice></div>}
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Relación / Parentesco</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-on-surface-variant">Cargando...</td></tr>
            ) : sortedRelaciones.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay relaciones configuradas.</td></tr>
            ) : (
              sortedRelaciones.map((rel) => {
                const esOtro = rel.nombre.trim().toLowerCase() === 'otro'
                return (
                  <tr key={rel.tipo_relacion_id} className={TABLE_CLASSES.row}>
                    <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>
                      {rel.nombre}
                      {esOtro && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/60">
                          Fijo del sistema
                        </span>
                      )}
                    </td>
                    <td className={TABLE_CLASSES.cell}><InUseBadge inUse={rel.en_uso} /></td>
                    <td className={TABLE_CLASSES.actionsCell}>
                      <div className="flex justify-end gap-1">
                        <IconButton
                          icon="edit"
                          label={esOtro ? "El tipo 'Otro' no se puede modificar" : "Editar"}
                          disabled={esOtro}
                          onClick={() => openEdit(rel)}
                        />
                        <IconButton
                          icon="delete"
                          label={esOtro ? "El tipo 'Otro' no se puede eliminar" : (rel.en_uso ? 'Está en uso por personas registradas' : 'Eliminar')}
                          disabled={esOtro || rel.en_uso}
                          onClick={() => setDeleteModal({ opened: true, item: rel })}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        opened={modal.opened}
        onClose={() => !saving && setModal({ opened: false, item: null })}
        centered
        title={<Text fw={700} size="xl">{modal.item ? 'Editar relación' : 'Nueva relación'}</Text>}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Field label="Nombre del parentesco / relación" htmlFor="rel-nombre" error={formError}>
            <input
              id="rel-nombre"
              className={INPUT_CLASS}
              value={nombre}
              maxLength={50}
              placeholder="Ej: Tío/a"
              onChange={(e) => setNombre(e.target.value)}
              required
              data-autofocus
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
        title="¿Eliminar relación?"
        message={`¿Estás seguro de que querés eliminar "${deleteModal.item?.nombre}"?`}
      />
    </SettingsSection>
  )
}

// ----------------------------------------------------
// SECCIÓN 4: OBRAS SOCIALES
// ----------------------------------------------------
function ObrasSocialesSection() {
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ opened: false, item: null })
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ opened: false, item: null })

  const load = async () => {
    setLoading(true)
    try {
      setObras(await getObrasSociales())
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar las obras sociales.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setModal({ opened: true, item: null })
    setNombre('')
    setFormError('')
  }
  const openEdit = (item) => {
    setModal({ opened: true, item })
    setNombre(item.nombre)
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
      if (modal.item) {
        await patchObraSocial(modal.item.obra_social_id, { nombre: nombre.trim() })
      } else {
        await postObraSocial({ nombre: nombre.trim() })
      }
      setModal({ opened: false, item: null })
      await load()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la obra social.'))
    } finally {
      setSaving(false)
    }
  }
  const handleDelete = async () => {
    if (!deleteModal.item) return
    await deleteObraSocial(deleteModal.item.obra_social_id)
    await load()
  }

  const sortedObras = useMemo(() => {
    return [...obras].sort(compareObrasSociales)
  }, [obras])

  return (
    <SettingsSection
      icon="health_and_safety"
      title="Obras sociales y prepagas"
      description="Listado de prestadores de salud disponibles para asignar a los jugadores del club."
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nueva obra social
        </button>
      )}
    >
      {error && <div className="p-4"><Notice tone="error">{error}</Notice></div>}
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Obra social / Prepaga</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-on-surface-variant">Cargando...</td></tr>
            ) : sortedObras.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay obras sociales registradas.</td></tr>
            ) : (
              sortedObras.map((obra) => {
                const esSinObraSocial = (obra.nombre || '').trim().toLowerCase() === 'sin obra social'
                return (
                  <tr key={obra.obra_social_id} className={TABLE_CLASSES.row}>
                    <td className={`${TABLE_CLASSES.cell} font-medium text-on-surface`}>
                      {obra.nombre}
                      {esSinObraSocial && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/60">
                          Fijo del sistema
                        </span>
                      )}
                    </td>
                    <td className={TABLE_CLASSES.cell}><InUseBadge inUse={obra.en_uso} /></td>
                    <td className={TABLE_CLASSES.actionsCell}>
                      <div className="flex justify-end gap-1">
                        <IconButton
                          icon="edit"
                          label={esSinObraSocial ? "La opción 'Sin obra social' no se puede modificar" : "Editar"}
                          disabled={esSinObraSocial}
                          onClick={() => openEdit(obra)}
                        />
                        <IconButton
                          icon="delete"
                          label={esSinObraSocial ? "La opción 'Sin obra social' no se puede eliminar" : (obra.en_uso ? 'Está asignada a jugadores' : 'Eliminar')}
                          disabled={esSinObraSocial || obra.en_uso}
                          onClick={() => setDeleteModal({ opened: true, item: obra })}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        opened={modal.opened}
        onClose={() => !saving && setModal({ opened: false, item: null })}
        centered
        title={<Text fw={700} size="xl">{modal.item ? 'Editar obra social' : 'Nueva obra social'}</Text>}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Field label="Nombre de la obra social o prepaga" htmlFor="obra-nombre" error={formError}>
            <input
              id="obra-nombre"
              className={INPUT_CLASS}
              value={nombre}
              maxLength={100}
              placeholder="Ej: OSDE"
              onChange={(e) => setNombre(e.target.value)}
              required
              data-autofocus
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
        title="¿Eliminar obra social?"
        message={`¿Estás seguro de que querés eliminar "${deleteModal.item?.nombre}"?`}
      />
    </SettingsSection>
  )
}

// ----------------------------------------------------
// SECCIÓN 5: TALLES DE INDUMENTARIA
// ----------------------------------------------------
function TallesSection() {
  const [talles, setTalles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ opened: false, item: null })
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ opened: false, item: null })

  const load = async () => {
    setLoading(true)
    try {
      setTalles(await getTallesIndumentaria())
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los talles.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setModal({ opened: true, item: null })
    setNombre('')
    setDescripcion('')
    setFormError('')
  }
  const openEdit = (item) => {
    setModal({ opened: true, item })
    setNombre(item.nombre)
    setDescripcion(item.descripcion || '')
    setFormError('')
  }
  const handleSave = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) {
      setFormError('El código o nombre del talle es obligatorio.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (modal.item) {
        await patchTalleIndumentaria(modal.item.talle_id, { nombre: nombre.trim().toUpperCase(), descripcion: descripcion.trim() })
      } else {
        await postTalleIndumentaria({ nombre: nombre.trim().toUpperCase(), descripcion: descripcion.trim() })
      }
      setModal({ opened: false, item: null })
      await load()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el talle.'))
    } finally {
      setSaving(false)
    }
  }
  const handleDelete = async () => {
    if (!deleteModal.item) return
    await deleteTalleIndumentaria(deleteModal.item.talle_id)
    await load()
  }

  const sortedTalles = useMemo(() => {
    return [...talles].sort(compareTalles)
  }, [talles])

  return (
    <SettingsSection
      icon="apparel"
      title="Talles de indumentaria"
      description="Talles oficiales para camisetas, pantalones y ropa deportiva de los jugadores."
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nuevo talle
        </button>
      )}
    >
      {error && <div className="p-4"><Notice tone="error">{error}</Notice></div>}
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Talle</th>
              <th className={TABLE_CLASSES.headCell}>Descripción</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">Cargando...</td></tr>
            ) : sortedTalles.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-on-surface-variant">No hay talles configurados.</td></tr>
            ) : (
              sortedTalles.map((talle) => (
                <tr key={talle.talle_id} className={TABLE_CLASSES.row}>
                  <td className={`${TABLE_CLASSES.cell} font-bold text-on-surface`}>{talle.nombre}</td>
                  <td className={`${TABLE_CLASSES.cell} text-on-surface-variant`}>{talle.descripcion || '—'}</td>
                  <td className={TABLE_CLASSES.cell}><InUseBadge inUse={talle.en_uso} /></td>
                  <td className={TABLE_CLASSES.actionsCell}>
                    <div className="flex justify-end gap-1">
                      <IconButton icon="edit" label="Editar" onClick={() => openEdit(talle)} />
                      <IconButton
                        icon="delete"
                        label={talle.en_uso ? 'Está asignado a jugadores' : 'Eliminar'}
                        disabled={talle.en_uso}
                        onClick={() => setDeleteModal({ opened: true, item: talle })}
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
        title={<Text fw={700} size="xl">{modal.item ? 'Editar talle' : 'Nuevo talle'}</Text>}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Field label="Talle / Código" htmlFor="talle-nombre" error={formError}>
            <input
              id="talle-nombre"
              className={INPUT_CLASS}
              value={nombre}
              maxLength={20}
              placeholder="Ej: M o 14 o XXL"
              onChange={(e) => setNombre(e.target.value)}
              required
              data-autofocus
            />
          </Field>
          <Field label="Descripción (opcional)" htmlFor="talle-descripcion">
            <input
              id="talle-descripcion"
              className={INPUT_CLASS}
              value={descripcion}
              maxLength={100}
              placeholder="Ej: Mediana o Infantil 14 años"
              onChange={(e) => setDescripcion(e.target.value)}
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
        title="¿Eliminar talle?"
        message={`¿Estás seguro de que querés eliminar el talle "${deleteModal.item?.nombre}"?`}
      />
    </SettingsSection>
  )
}

// ----------------------------------------------------
// COMPONENTE PRINCIPAL: PERSONAS SETTINGS
// ----------------------------------------------------
const SUBTABS = [
  { id: 'cargos', label: 'Cargos docentes', icon: 'school' },
  { id: 'geografia', label: 'Localidades y barrios', icon: 'location_city' },
  { id: 'relaciones', label: 'Vínculos familiares', icon: 'diversity_1' },
  { id: 'obras_sociales', label: 'Obras sociales', icon: 'health_and_safety' },
  { id: 'talles', label: 'Talles', icon: 'apparel' },
]

export default function PersonasSettings() {
  const [activeSubTab, setActiveSubTab] = useState('cargos')

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de sub-sección con estilo pills */}
      <div className="flex flex-wrap gap-2 border-b border-outline-variant/30 pb-3">
        {SUBTABS.map((tab) => {
          const active = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeSubTab === 'cargos' && <CargosDocentesSection />}
      {activeSubTab === 'geografia' && <GeografiaSection />}
      {activeSubTab === 'relaciones' && <RelacionesSection />}
      {activeSubTab === 'obras_sociales' && <ObrasSocialesSection />}
      {activeSubTab === 'talles' && <TallesSection />}
    </div>
  )
}

