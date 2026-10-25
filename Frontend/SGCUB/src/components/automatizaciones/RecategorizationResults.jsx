import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import {
  acceptAllRecategorizationSuggestions,
  decideRecategorizationResult,
  getRecategorizationResults,
} from '../../api/automatizaciones'
import useCategorias from '../../hooks/useCategorias'
import { SUBMIT_BUTTON_CLASS } from '../finanzas/formParts'
import { getErrorMessage } from '../personas/format'
import StatCard from '../shared/StatCard'
import EditRecategorizationModal from './EditRecategorizationModal'
import RecategorizationLogModal from './RecategorizationLogModal'
import RecategorizationResultsTable from './RecategorizationResultsTable'
import { DECISIONS, RESULT_TYPES } from './recategorization'

const EMPTY_PAGE = { results: [], count: 0, page: 1, page_size: 20, total_pages: 1 }

const getTabs = (execution) => [
  { type: RESULT_TYPES.exito, label: 'Cambios realizados', count: execution.exitosos },
  { type: RESULT_TYPES.pendiente, label: 'Pendientes de revisión', count: execution.pendientes_sin_revisar, attention: execution.pendientes_sin_revisar > 0 },
  { type: RESULT_TYPES.error, label: 'Errores', count: execution.errores },
]

function ResultsPagination({ data, isLoading, onPageChange }) {
  const firstRow = data.count === 0 ? 0 : (data.page - 1) * data.page_size + 1
  const lastRow = (data.page - 1) * data.page_size + data.results.length

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>{isLoading ? 'Cargando resultados...' : `Mostrando ${firstRow}–${lastRow} de ${data.count.toLocaleString('es-AR')} jugadores`}</p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(data.page - 1)}
          disabled={isLoading || data.page <= 1}
          aria-label="Página anterior"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
        </button>
        <span className="whitespace-nowrap font-medium text-slate-700">Página {data.page} de {data.total_pages}</span>
        <button
          type="button"
          onClick={() => onPageChange(data.page + 1)}
          disabled={isLoading || data.page >= data.total_pages}
          aria-label="Página siguiente"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </div>
  )
}

function AcceptAllModal({ opened, pendingCount, saving, onConfirm, onClose }) {
  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700} size="xl">Aceptar todos los sugeridos</Text>} centered>
      <div className="flex flex-col gap-5">
        <p className="text-base text-on-surface-variant">
          Se aplicará la categoría sugerida a los {pendingCount} jugadores pendientes de revisión. Las secundarias marcadas
          para quitar se eliminarán. ¿Querés continuar?
        </p>
        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
          >
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className={SUBMIT_BUTTON_CLASS}>
            <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`} aria-hidden="true">
              {saving ? 'progress_activity' : 'done_all'}
            </span>
            <span>{saving ? 'Aplicando...' : 'Aceptar sugeridos'}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function RecategorizationResults({ execution, canEdit, onExecutionChange }) {
  const [activeTab, setActiveTab] = useState(() => (
    execution.pendientes_sin_revisar > 0 ? RESULT_TYPES.pendiente : RESULT_TYPES.exito
  ))
  const [page, setPage] = useState(1)
  const [order, setOrder] = useState('asc')
  const [reloadKey, setReloadKey] = useState(0)
  const [data, setData] = useState(EMPTY_PAGE)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [isAcceptAllOpen, setIsAcceptAllOpen] = useState(false)
  const [isAcceptingAll, setIsAcceptingAll] = useState(false)
  const [isLogOpen, setIsLogOpen] = useState(false)
  const { categorias } = useCategorias()
  const tabs = getTabs(execution)

  useEffect(() => {
    let active = true
    getRecategorizationResults(execution.id, activeTab, page, order)
      .then((received) => {
        if (!active) return
        setData(received)
        setLoadError(null)
      })
      .catch((requestError) => { if (active) setLoadError(requestError) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [execution.id, activeTab, page, order, reloadKey])

  const startLoading = () => {
    setIsLoading(true)
    setActionError('')
  }

  const changeTab = (type) => {
    if (type === activeTab) return
    startLoading()
    setActiveTab(type)
    setPage(1)
  }

  const changePage = (nextPage) => {
    startLoading()
    setPage(nextPage)
  }

  const toggleOrder = () => {
    startLoading()
    setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    setPage(1)
  }

  const applyDecision = async (result, payload) => {
    const response = await decideRecategorizationResult(result.id, payload)
    onExecutionChange(response.ultima_ejecucion)
    setData((current) => ({
      ...current,
      results: current.results.map((row) => (row.id === result.id ? response.resultado : row)),
    }))
  }

  const decideQuickly = async (result, decision) => {
    setBusyId(result.id)
    setActionError('')
    try {
      await applyDecision(result, { decision })
    } catch (error) {
      setActionError(getErrorMessage(error, 'No se pudo registrar la decisión.'))
    } finally {
      setBusyId(null)
    }
  }

  const saveEdit = async (categories) => {
    await applyDecision(editing, { decision: DECISIONS.editada, ...categories })
    setEditing(null)
  }

  const acceptAll = async () => {
    setIsAcceptingAll(true)
    setActionError('')
    try {
      const response = await acceptAllRecategorizationSuggestions(execution.id)
      onExecutionChange(response.ultima_ejecucion)
      setIsAcceptAllOpen(false)
      setReloadKey((key) => key + 1)
    } catch (error) {
      setActionError(getErrorMessage(error, 'No se pudieron aceptar las sugerencias.'))
      setIsAcceptAllOpen(false)
    } finally {
      setIsAcceptingAll(false)
    }
  }

  return (
    <section aria-labelledby="recategorization-results-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="recategorization-results-title" className="text-base font-bold text-slate-900">
            Resultados de la recategorización {execution.anio}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Las revisiones quedan guardadas: podés salir de esta pantalla y continuar más tarde.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsLogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">receipt_long</span>
          Ver registro
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Cambios realizados"
          value={execution.exitosos}
          caption="automáticos"
          icon="check_circle"
          tone="positive"
          onClick={() => changeTab(RESULT_TYPES.exito)}
          isSelected={activeTab === RESULT_TYPES.exito}
        />
        <StatCard
          label="Pendientes de revisión"
          value={execution.pendientes_sin_revisar}
          caption={`de ${execution.pendientes}`}
          icon="rule"
          tone="warning"
          onClick={() => changeTab(RESULT_TYPES.pendiente)}
          isSelected={activeTab === RESULT_TYPES.pendiente}
        />
        <StatCard
          label="Errores"
          value={execution.errores}
          caption="a corregir"
          icon="error"
          tone="error"
          onClick={() => changeTab(RESULT_TYPES.error)}
          isSelected={activeTab === RESULT_TYPES.error}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div role="tablist" aria-label="Resultados de la recategorización" className="-mb-px flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = tab.type === activeTab
              return (
                <button
                  key={tab.type}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => changeTab(tab.type)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                  {tab.attention && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Requiere atención" />}
                </button>
              )
            })}
          </div>
          {canEdit && activeTab === RESULT_TYPES.pendiente && execution.pendientes_sin_revisar > 0 && (
            <button
              type="button"
              onClick={() => setIsAcceptAllOpen(true)}
              disabled={busyId !== null}
              className="mb-3 inline-flex items-center justify-center gap-2 self-start rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">done_all</span>
              Aceptar todos los sugeridos
            </button>
          )}
        </div>

        {actionError && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {actionError}
          </div>
        )}

        <RecategorizationResultsTable
          type={activeTab}
          rows={data.results}
          isLoading={isLoading}
          error={loadError}
          order={order}
          onSort={toggleOrder}
          busyId={busyId}
          canEdit={canEdit}
          onAccept={(result) => decideQuickly(result, DECISIONS.aceptada)}
          onKeep={(result) => decideQuickly(result, DECISIONS.mantenida)}
          onEdit={setEditing}
        />

        <ResultsPagination data={data} isLoading={isLoading} onPageChange={changePage} />
      </div>

      <EditRecategorizationModal
        result={editing}
        categories={categorias}
        onConfirm={saveEdit}
        onClose={() => setEditing(null)}
      />
      <AcceptAllModal
        opened={isAcceptAllOpen}
        pendingCount={execution.pendientes_sin_revisar}
        saving={isAcceptingAll}
        onConfirm={acceptAll}
        onClose={() => setIsAcceptAllOpen(false)}
      />
      <RecategorizationLogModal execution={execution} opened={isLogOpen} onClose={() => setIsLogOpen(false)} />
    </section>
  )
}
