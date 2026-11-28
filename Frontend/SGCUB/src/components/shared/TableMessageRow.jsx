import { SecondaryButton } from '../personas/tabs/parts'
import { TableSkeletonRows } from './Skeleton'

export default function TableMessageRow({
  colSpan,
  isLoading = false,
  isEmpty = false,
  error,
  loadingText,
  errorText,
  emptyText,
  onRetry,
  onClearFilters,
}) {
  if (isLoading) return <TableSkeletonRows colSpan={colSpan} label={loadingText} />
  if (!isEmpty) return null

  const hasError = Boolean(error)
  const action = hasError
    ? onRetry && <SecondaryButton icon="refresh" onClick={onRetry}>Reintentar</SecondaryButton>
    : onClearFilters && <SecondaryButton icon="filter_alt_off" onClick={onClearFilters}>Limpiar filtros</SecondaryButton>

  return (
    <tr>
      <td className="py-10 px-4 text-center text-on-surface-variant" colSpan={colSpan}>
        <div className="flex flex-col items-center gap-3" role={hasError ? 'alert' : undefined}>
          <p className="text-base">
            {hasError ? errorText : emptyText}
            {hasError && onRetry && ' Revisá la conexión y probá de nuevo.'}
          </p>
          {action}
        </div>
      </td>
    </tr>
  )
}
