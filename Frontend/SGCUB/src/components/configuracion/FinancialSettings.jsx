import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import useConceptosMovimiento from '../../hooks/useConceptosMovimiento'
import { GENERO_OPTIONS, GENERO_TAB_TONES, getGeneroLabel } from '../categorias/categoriaFormat'
import { CONCEPT_ORIGINS, INCOME, isOtherConcept } from '../finanzas/conceptOrigins'
import { formatDate, getErrorMessage } from '../personas/format'
import { TableSkeletonRows } from '../shared/Skeleton'
import TableTabs from '../shared/TableTabs'
import { tabId, tabPanelId } from '../shared/tabIds'
import { CUOTA_FIELD_LABELS, SURCHARGE_TYPES, formatCuotaValue, formatVigencia, scheduledVersions } from './financialFields'
import { IntegerInput, MoneyInput, PercentInput } from './formattedInputs'
import { BUTTON_CLASSES, SMALL_BUTTON_CLASSES, TABLE_CLASSES, compactInputClass } from './settingsForm'
import { BlockTitle, CompactField, CompactSelect, IconButton, Notice, SettingsSection, StatusPill } from './settingsParts'

const CellError = ({ message }) => (message ? <p className="mt-1 text-xs font-medium text-error" role="alert">{message}</p> : null)

const previousValues = (version) => ({
  ...version,
  ...Object.fromEntries((version.cambios ?? []).map((cambio) => [cambio.campo, cambio.anterior])),
})

function RevertVersionModal({ version, opened, busy, error, onClose, onConfirm }) {
  return (
    <Modal
      opened={opened}
      onClose={() => !busy && onClose()}
      centered
      size="md"
      title={<Text fw={700} size="xl">Revertir cambio programado</Text>}
    >
      {version && (
        <div className="flex flex-col gap-4">
          <p className="text-base text-on-surface">
            ¿Estás seguro de que querés revertir el cambio programado{' '}
            <strong>{formatVigencia(version.periodo_vigencia).toLowerCase()}</strong>?
            {' '}Las cuotas impagas o con pago parcial de ese período en adelante volverán a los valores anteriores:
          </p>

          <ul className="rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-4 py-3 text-sm text-on-surface flex flex-col gap-1.5">
            {version.cambios.map((cambio) => (
              <li key={cambio.campo} className="flex items-center justify-between gap-3">
                <span className="font-medium">{CUOTA_FIELD_LABELS[cambio.campo]}</span>
                <span>
                  <span className="text-on-surface-variant line-through mr-2">
                    {formatCuotaValue(cambio.campo, cambio.nuevo, version)}
                  </span>
                  <span className="font-semibold text-primary">
                    {formatCuotaValue(cambio.campo, cambio.anterior, previousValues(version))}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {error && <Notice tone="error">{error}</Notice>}

          <div className="mt-2 flex justify-end gap-2 border-t border-outline-variant/30 pt-4">
            <button type="button" className={BUTTON_CLASSES.secondary} onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className={BUTTON_CLASSES.danger} onClick={onConfirm} disabled={busy}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">undo</span>
              {busy ? 'Revirtiendo...' : 'Revertir'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ScheduledVersions({ versions, onRevert, onReverted }) {
  const [confirmingVersion, setConfirmingVersion] = useState(null)
  const [reverting, setReverting] = useState(false)
  const [error, setError] = useState('')

  if (!versions.length) return null

  const handleConfirmRevert = async () => {
    if (!confirmingVersion) return
    setReverting(true)
    setError('')
    try {
      const result = await onRevert(confirmingVersion.configuracion_financiera_id)
      setConfirmingVersion(null)
      onReverted?.(result)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo revertir el cambio programado.'))
    } finally {
      setReverting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2 text-sm text-on-surface" role="status">
        <span className="material-symbols-outlined shrink-0 text-[18px] text-primary" aria-hidden="true">event_upcoming</span>
        <div className="flex-1">
          <p className="font-semibold text-primary">Cambios programados</p>
          <ul className="mt-2 flex flex-col divide-y divide-outline-variant/30">
            {versions.map((version) => (
              <li key={version.configuracion_financiera_id} className="flex items-start sm:items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 text-xs leading-relaxed">
                  <span className="font-semibold text-sm text-on-surface">{formatVigencia(version.periodo_vigencia)}</span>
                  {' '}<span className="text-on-surface-variant">(cargado por {version.responsable || version.usuario_nombre || 'el sistema'} el {formatDate(version.fecha_creacion)}):</span>
                  {' '}<span className="font-medium text-on-surface">{version.cambios.map((cambio) => `${CUOTA_FIELD_LABELS[cambio.campo]} ${formatCuotaValue(cambio.campo, cambio.nuevo, version)}`).join(' · ')}</span>
                </span>
                <button
                  type="button"
                  className={`${SMALL_BUTTON_CLASSES.secondary} shrink-0 self-start sm:self-center`}
                  disabled={reverting}
                  onClick={() => {
                    setError('')
                    setConfirmingVersion(version)
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">undo</span>
                  Revertir
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <RevertVersionModal
        version={confirmingVersion}
        opened={Boolean(confirmingVersion)}
        busy={reverting}
        error={error}
        onClose={() => setConfirmingVersion(null)}
        onConfirm={handleConfirmRevert}
      />
    </div>
  )
}

function FeesSection({ config, onShowHistory, onReverted }) {
  const form = config.draft.financiera
  const errors = config.errors.financiera
  const setField = config.setFinancialField

  const moneyField = (field, label, hint) => (
    <CompactField id={field} label={label} hint={hint} error={errors[field]} className="w-36">
      <MoneyInput id={field} value={form[field]} onChange={(value) => setField(field, value)} invalid={Boolean(errors[field])} />
    </CompactField>
  )

  return (
    <SettingsSection
      icon="payments"
      title="Aranceles y recargos por mora"
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.link} onClick={onShowHistory}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">history</span>
          Historial de versiones
        </button>
      )}
    >
      <ScheduledVersions
        versions={scheduledVersions(config.versiones, config.financiera)}
        onRevert={config.revertVersion}
        onReverted={onReverted}
      />

      <div>
        <BlockTitle>Cuotas y aranceles</BlockTitle>
        <div className="flex flex-wrap items-start gap-6">
          {moneyField('monto_cuota_social', 'Cuota social')}
          {moneyField('monto_cuota_deportiva', 'Cuota deportiva', '')}
          {moneyField('monto_inscripcion', 'Inscripción inicial', '')}
        </div>
      </div>

      <hr className="border-outline-variant/30" />

      <div>
        <BlockTitle>Recargos por mora</BlockTitle>
        <div className="flex flex-col gap-2">
          {[1, 2].map((number) => {
            const typeField = `tipo_recargo_${number}`
            const valueField = `valor_recargo_${number}`
            const ValueInput = form[typeField] === 'Porcentaje' ? PercentInput : MoneyInput
            return (
              <div key={number} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <span className="w-32 pt-1.5 text-sm font-medium text-on-surface">{`Al ${number}° vencimiento:`}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CompactSelect
                      small
                      className="w-40"
                      value={form[typeField]}
                      onChange={(event) => setField(typeField, event.target.value)}
                      aria-label={`Tipo de recargo al ${number}° vencimiento`}
                    >
                      {SURCHARGE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </CompactSelect>
                    <div className="w-28">
                      <ValueInput
                        small
                        value={form[valueField]}
                        onChange={(value) => setField(valueField, value)}
                        invalid={Boolean(errors[valueField])}
                        aria-label={`Valor del recargo al ${number}° vencimiento`}
                      />
                    </div>
                  </div>
                  <CellError message={errors[valueField]} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SettingsSection>
  )
}

function CalendarSection({ config }) {
  const form = config.draft.financiera
  const errors = config.errors.financiera
  const setField = config.setFinancialField

  const dayField = (field, label, help) => (
    <CompactField id={field} label={label} help={help} error={errors[field]} className="w-44">
      <IntegerInput
        id={field}
        maxLength={2}
        placeholder="1 a 28"
        value={form[field]}
        onChange={(value) => setField(field, value)}
        invalid={Boolean(errors[field])}
      />
    </CompactField>
  )

  return (
    <SettingsSection
      icon="calendar_month"
      title="Calendario de facturación"
    >
      <div className="flex flex-wrap items-start gap-6">
        {dayField('dia_generacion', 'Día de generación', 'Se crean las cuotas del mes')}
        {dayField('dia_vencimiento_1', 'Día del 1° vencimiento', 'Luego se aplica el 1° recargo')}
        {dayField('dia_vencimiento_2', 'Día del 2° vencimiento', 'Luego se aplica el 2° recargo')}
      </div>
    </SettingsSection>
  )
}

function PaymentMethodRow({ medio, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(medio.nombre)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setEditing(false)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar el medio de pago.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className={TABLE_CLASSES.row}>
      <td className={TABLE_CLASSES.cell}>
        {editing ? (
          <input
            className={compactInputClass(false, 'max-w-xs')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Nombre del medio de pago"
            autoFocus
          />
        ) : (
          <span className={`font-medium ${medio.activo ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>{medio.nombre}</span>
        )}
        <CellError message={error} />
      </td>
      <td className={TABLE_CLASSES.cell}><StatusPill active={medio.activo} /></td>
      <td className={TABLE_CLASSES.actionsCell}>
        <div className="flex justify-end gap-1">
          {editing ? (
            <>
              <button type="button" className={SMALL_BUTTON_CLASSES.primary} disabled={busy || !name.trim()} onClick={() => run(() => onUpdate(medio.medio_pago_id, { nombre: name }))}>Guardar</button>
              <button type="button" className={SMALL_BUTTON_CLASSES.secondary} disabled={busy} onClick={() => { setEditing(false); setName(medio.nombre); setError('') }}>Cancelar</button>
            </>
          ) : (
            <>
              <IconButton icon="edit" label="Renombrar" disabled={busy} onClick={() => setEditing(true)} />
              <IconButton
                icon={medio.activo ? 'toggle_on' : 'toggle_off'}
                label={medio.activo ? 'Deshabilitar' : 'Habilitar'}
                disabled={busy}
                onClick={() => run(() => onUpdate(medio.medio_pago_id, { activo: !medio.activo }))}
              />
              <IconButton
                icon="delete"
                label={medio.en_uso ? 'Ya se usó en pagos: deshabilitalo en lugar de eliminarlo' : 'Eliminar'}
                disabled={busy || medio.en_uso}
                onClick={() => run(() => onDelete(medio.medio_pago_id))}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function PaymentMethodsSection({ medios, onCreate, onUpdate, onDelete }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onCreate({ nombre: name })
      setName('')
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo agregar el medio de pago.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      icon="account_balance_wallet"
      title="Medios de pago aceptados"
      flush
    >
      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Medio de pago</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {medios.map((medio) => (
              <PaymentMethodRow key={medio.medio_pago_id} medio={medio} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </tbody>
          <tfoot className="border-t border-outline-variant/30 bg-surface-container-low/40">
            <tr>
              <td colSpan={3} className={TABLE_CLASSES.cell}>
                <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className={compactInputClass(Boolean(error), 'sm:max-w-xs')}
                    placeholder="Nuevo medio de pago, ej: Tarjeta de débito"
                    value={name}
                    onChange={(event) => { setName(event.target.value); setError('') }}
                    aria-label="Nuevo medio de pago"
                  />
                  <button type="submit" className={SMALL_BUTTON_CLASSES.primary} disabled={saving || !name.trim()}>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
                    {saving ? 'Guardando...' : 'Guardar medio'}
                  </button>
                </form>
                <CellError message={error} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SettingsSection>
  )
}

const CONCEPT_TABS_ID = 'conceptos-origen'

function MovementConceptsSection() {
  const { concepts, isLoading, error: loadError, createConcept, deleteConcept } = useConceptosMovimiento()
  const [selectedOrigin, setSelectedOrigin] = useState(INCOME)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [saving, setSaving] = useState(false)

  const filtered = concepts.filter((c) => c.origen === selectedOrigin)
  const origin = CONCEPT_ORIGINS.find((option) => option.value === selectedOrigin)
  const tallestTab = Math.max(1, ...CONCEPT_ORIGINS.map((option) => concepts.filter((c) => c.origen === option.value).length))
  const fillerRows = Math.max(0, tallestTab - Math.max(1, filtered.length))

  const add = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createConcept(name.trim(), selectedOrigin)
      setName('')
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo agregar el concepto.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (concept) => {
    setBusyId(concept.concepto_movimiento_id)
    setError('')
    try {
      await deleteConcept(concept.concepto_movimiento_id)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo eliminar el concepto.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <SettingsSection
      icon="swap_horiz"
      title="Conceptos de otros movimientos"
      flush
    >
      <TableTabs
        id={CONCEPT_TABS_ID}
        label="Origen de concepto"
        options={CONCEPT_ORIGINS.map((option) => ({
          value: option.value,
          label: option.label,
          count: isLoading ? null : concepts.filter((c) => c.origen === option.value).length,
        }))}
        value={selectedOrigin}
        onChange={(value) => { setSelectedOrigin(value); setError('') }}
      />

      <div id={tabPanelId(CONCEPT_TABS_ID)} role="tabpanel" aria-labelledby={tabId(CONCEPT_TABS_ID, selectedOrigin)} className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Concepto</th>
              <th className={TABLE_CLASSES.headCell}>Tipo</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <TableSkeletonRows colSpan={3} rows={3} cellClassName="py-4 px-6" label="Cargando conceptos..." />
            )}
            {!isLoading && filtered.length === 0 && (
              <tr className={TABLE_CLASSES.row}>
                <td colSpan={3} className={TABLE_CLASSES.actionsCell}>
                  <div className="flex h-8 items-center px-2 text-sm text-on-surface-variant">No hay conceptos cargados.</div>
                </td>
              </tr>
            )}
            {!isLoading && filtered.map((c) => {
              const isProtected = isOtherConcept(c.nombre)
              const busy = busyId === c.concepto_movimiento_id
              return (
                <tr key={c.concepto_movimiento_id} className={TABLE_CLASSES.row}>
                  <td className={TABLE_CLASSES.cell}>
                    <span className="font-medium text-on-surface">{c.nombre}</span>
                  </td>
                  <td className={TABLE_CLASSES.cell}>
                    <span className="text-xs text-on-surface-variant">
                      {CONCEPT_ORIGINS.find((option) => option.value === c.origen)?.singular ?? c.origen}
                    </span>
                  </td>
                  <td className={TABLE_CLASSES.actionsCell}>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        icon="delete"
                        label={
                          isProtected
                            ? 'Concepto del sistema (no se puede borrar)'
                            : c.en_uso
                              ? 'Ya se usó en ingresos o devoluciones registrados'
                              : 'Eliminar concepto'
                        }
                        disabled={busy || isProtected || c.en_uso}
                        onClick={() => remove(c)}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isLoading && Array.from({ length: fillerRows }, (_, index) => (
              <tr key={`filler-${index}`} aria-hidden="true" className="border-t border-transparent">
                <td colSpan={3} className={TABLE_CLASSES.actionsCell}><div className="h-8" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-outline-variant/30 bg-surface-container-low/40">
            <tr>
              <td colSpan={3} className={TABLE_CLASSES.cell}>
                <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className={compactInputClass(Boolean(error), 'sm:max-w-xs')}
                    placeholder={`Nuevo concepto, ${origin?.placeholder.toLowerCase()}`}
                    value={name}
                    onChange={(event) => { setName(event.target.value); setError('') }}
                    aria-label="Nuevo concepto"
                  />
                  <button type="submit" className={SMALL_BUTTON_CLASSES.primary} disabled={saving || !name.trim()}>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
                    {saving ? 'Guardando...' : 'Guardar concepto'}
                  </button>
                </form>
                <CellError message={error || (loadError ? 'No se pudieron cargar los conceptos.' : '')} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SettingsSection>
  )
}

const byCategoryOrder = (a, b) => (
  (b.edad_maxima ?? 0) - (a.edad_maxima ?? 0)
  || (b.edad_minima ?? 0) - (a.edad_minima ?? 0)
  || a.genero.localeCompare(b.genero)
  || a.nombre.localeCompare(b.nombre)
)

function CategoryGroup({ group, categorias, selected, onToggle }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${GENERO_TAB_TONES[group.value].text}`}>
        {group.label}
      </legend>
      {categorias.map((categoria) => {
        const id = `categoria-exenta-${categoria.categoria_id}`
        return (
          <label
            key={categoria.categoria_id}
            htmlFor={id}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-on-surface hover:bg-surface-container-low cursor-pointer"
          >
            <input
              id={id}
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
              checked={selected.has(categoria.categoria_id)}
              onChange={() => onToggle(categoria.categoria_id)}
            />
            {categoria.nombre}
          </label>
        )
      })}
    </fieldset>
  )
}

function ExemptCategoriesForm({ categorias, exentas, onApply, onClose }) {
  const [selected, setSelected] = useState(
    () => new Set(categorias.filter((categoria) => exentas[categoria.categoria_id]).map((categoria) => categoria.categoria_id)),
  )

  const toggle = (categoriaId) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(categoriaId)) next.delete(categoriaId)
    else next.add(categoriaId)
    return next
  })

  const apply = () => {
    onApply(selected)
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-on-surface-variant">
        Marcá las categorías cuyos jugadores no deben pagar cuota. Los cambios se aplican al guardar la configuración.
      </p>
      <div className="grid max-h-[60vh] grid-cols-1 gap-6 overflow-y-auto sm:grid-cols-2">
        {GENERO_OPTIONS.map((group) => (
          <CategoryGroup
            key={group.value}
            group={group}
            categorias={categorias.filter((categoria) => categoria.genero === group.value)}
            selected={selected}
            onToggle={toggle}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-outline-variant/30 pt-4">
        <button type="button" className={BUTTON_CLASSES.secondary} onClick={onClose}>Cancelar</button>
        <button type="button" className={BUTTON_CLASSES.primary} onClick={apply}>Aplicar</button>
      </div>
    </div>
  )
}

function ExemptCategoriesModal({ opened, onClose, ...props }) {
  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title={<Text fw={700} size="xl">Categorías exentas de pago</Text>}>
      {opened && <ExemptCategoriesForm onClose={onClose} {...props} />}
    </Modal>
  )
}

function ExemptCategoriesSection({ config }) {
  const [modalOpened, setModalOpened] = useState(false)
  const categorias = config.categorias.filter((categoria) => categoria.genero).sort(byCategoryOrder)
  const exempt = categorias.filter((categoria) => config.draft.exentas[categoria.categoria_id])

  const apply = (selected) => {
    categorias.forEach((categoria) => {
      const value = selected.has(categoria.categoria_id)
      if (value !== Boolean(config.draft.exentas[categoria.categoria_id])) config.setExemptCategory(categoria.categoria_id, value)
    })
  }

  return (
    <SettingsSection
      icon="money_off"
      title="Categorías exentas de pago"
      flush
    >

      <div className={TABLE_CLASSES.wrapper}>
        <table className={TABLE_CLASSES.table}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Categoría</th>
              <th className={TABLE_CLASSES.headCell}>Género</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {exempt.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-4 text-sm text-on-surface-variant">No hay categorías exentas de pago.</td></tr>
            )}
            {exempt.map((categoria) => (
              <tr key={categoria.categoria_id} className={TABLE_CLASSES.row}>
                <td className={TABLE_CLASSES.cell}>
                  <span className="font-medium text-on-surface">{categoria.nombre}</span>
                  {!categoria.exenta_cuota && (
                    <span className="ml-2 text-xs text-on-surface-variant">(sin guardar)</span>
                  )}
                </td>
                <td className={TABLE_CLASSES.cell}>
                  <span className="text-xs text-on-surface-variant">{getGeneroLabel(categoria.genero)}</span>
                </td>
                <td className={TABLE_CLASSES.actionsCell}>
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon="delete"
                      label="Quitar exención"
                      onClick={() => config.setExemptCategory(categoria.categoria_id, false)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-outline-variant/30 bg-surface-container-low/40">
            <tr>
              <td colSpan={3} className={TABLE_CLASSES.cell}>
                <button type="button" className={SMALL_BUTTON_CLASSES.secondary} onClick={() => setModalOpened(true)}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                  Agregar categorías
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ExemptCategoriesModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        categorias={categorias}
        exentas={config.draft.exentas}
        onApply={apply}
      />
    </SettingsSection>
  )
}

export default function FinancialSettings({ config, onShowHistory, onReverted }) {
  return (
    <div className="flex flex-col">
      <FeesSection config={config} onShowHistory={onShowHistory} onReverted={onReverted} />
      <CalendarSection config={config} />
      <ExemptCategoriesSection config={config} />
      <PaymentMethodsSection medios={config.medios} onCreate={config.createMedio} onUpdate={config.updateMedio} onDelete={config.deleteMedio} />
      <MovementConceptsSection />
    </div>
  )
}
