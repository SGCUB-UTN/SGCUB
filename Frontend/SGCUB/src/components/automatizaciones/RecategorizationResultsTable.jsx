import SortableHeader from '../shared/SortableHeader'
import { DECISION_STYLES, RESULT_TYPES, categoryName } from './recategorization'

const HEADER_CELL_CLASS = 'px-4 py-3'
const ICON_BUTTON_CLASS = 'inline-flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

const COLUMNS = {
  [RESULT_TYPES.exito]: ['Jugador', 'birth', 'Categoría anterior', 'Categoría actual', 'Acciones'],
  [RESULT_TYPES.pendiente]: ['Jugador', 'birth', 'Principal anterior', 'Secundaria anterior', 'Motivo de revisión', 'Acciones'],
  [RESULT_TYPES.error]: ['Jugador', 'birth', 'Motivo', 'Acciones'],
}

const EMPTY_TEXT = {
  [RESULT_TYPES.exito]: 'No hubo cambios automáticos en esta ejecución.',
  [RESULT_TYPES.pendiente]: 'No hay jugadores que requieran revisión manual.',
  [RESULT_TYPES.error]: 'No hubo errores en esta ejecución.',
}

function DecisionBadge({ result }) {
  if (!result.decision) return null
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${DECISION_STYLES[result.decision]}`}>
      {result.decision_display}
    </span>
  )
}

function PlayerCell({ result }) {
  return (
    <td className="px-4 py-3">
      <p className="font-semibold text-slate-900">{result.jugador}</p>
      <p className="text-xs text-slate-500">DNI {result.dni}</p>
    </td>
  )
}

function CategoryCell({ main, secondary }) {
  return (
    <td className="px-4 py-3">
      <p className="font-medium text-slate-800">{categoryName(main)}</p>
      {secondary && <p className="text-xs text-slate-500">Secundaria: {secondary.nombre}</p>}
    </td>
  )
}

function ReasonCell({ result }) {
  return (
    <td className="px-4 py-3">
      <p className="font-medium text-slate-800">{result.motivo_display}</p>
      {result.detalle && <p className="mt-0.5 text-xs text-slate-500">{result.detalle}</p>}
      {result.tipo === RESULT_TYPES.pendiente && !result.decision && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {result.categoria_sugerida && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
              Sugerida: {result.categoria_sugerida.nombre}
            </span>
          )}
          {result.quitar_secundaria_sugerido && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Quitar secundaria
            </span>
          )}
        </div>
      )}
    </td>
  )
}

function ActionsCell({ result, canEdit, isBusy, onAccept, onKeep, onEdit }) {
  const isPendingReview = result.tipo === RESULT_TYPES.pendiente && !result.decision
  const editLabel = result.tipo === RESULT_TYPES.exito ? 'Modificar' : 'Editar'

  return (
    <td className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {!isPendingReview && <DecisionBadge result={result} />}
        {canEdit && isPendingReview && (
          <>
            <button
              type="button"
              onClick={() => onAccept(result)}
              disabled={isBusy || !result.categoria_sugerida}
              title={result.categoria_sugerida ? `Aceptar ${result.categoria_sugerida.nombre}` : 'Sin sugerencia'}
              className={`${ICON_BUTTON_CLASS} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check</span>
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => onKeep(result)}
              disabled={isBusy}
              title="Mantener las categorías actuales"
              className={`${ICON_BUTTON_CLASS} border-slate-200 text-slate-700 hover:bg-slate-50`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">history</span>
              Mantener
            </button>
          </>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(result)}
            disabled={isBusy}
            title={`${editLabel} categorías de ${result.jugador}`}
            className={`${ICON_BUTTON_CLASS} border-sky-200 text-sky-700 hover:bg-sky-50`}
          >
            <span className={`material-symbols-outlined text-[16px] ${isBusy ? 'animate-spin' : ''}`} aria-hidden="true">
              {isBusy ? 'progress_activity' : 'edit'}
            </span>
            {editLabel}
          </button>
        )}
      </div>
    </td>
  )
}

function ResultRow({ type, result, ...actions }) {
  return (
    <tr className="align-top text-slate-600">
      <PlayerCell result={result} />
      <td className="whitespace-nowrap px-4 py-3">{result.anio_nacimiento ?? 'Sin fecha'}</td>
      {type === RESULT_TYPES.exito && (
        <>
          <CategoryCell main={result.categoria_anterior} secondary={result.categoria_secundaria_anterior} />
          <CategoryCell main={result.categoria_nueva} secondary={result.categoria_secundaria_nueva} />
        </>
      )}
      {type === RESULT_TYPES.pendiente && (
        <>
          <CategoryCell main={result.categoria_anterior} />
          <CategoryCell main={result.categoria_secundaria_anterior} />
          <ReasonCell result={result} />
        </>
      )}
      {type === RESULT_TYPES.error && <ReasonCell result={result} />}
      <ActionsCell result={result} {...actions} />
    </tr>
  )
}

export default function RecategorizationResultsTable({ type, rows, isLoading, error, order, onSort, busyId, ...actions }) {
  const columns = COLUMNS[type]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-sky-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            {columns.map((column) => (column === 'birth' ? (
              <SortableHeader
                key={column}
                etiqueta="Año de nacimiento"
                columna="anio_nacimiento"
                orden={{ columna: 'anio_nacimiento', direccion: order }}
                onOrdenar={onSort}
                className={HEADER_CELL_CLASS}
              />
            ) : (
              <th key={column} scope="col" className={HEADER_CELL_CLASS}>{column}</th>
            )))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(isLoading || error || rows.length === 0) ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500" role={isLoading ? 'status' : undefined}>
                {isLoading ? 'Cargando resultados...' : error ? 'No se pudieron cargar los resultados.' : EMPTY_TEXT[type]}
              </td>
            </tr>
          ) : rows.map((result) => (
            <ResultRow key={result.id} type={type} result={result} isBusy={busyId === result.id} {...actions} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
