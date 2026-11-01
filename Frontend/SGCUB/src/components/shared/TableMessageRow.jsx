import { TableSkeletonRows } from './Skeleton'

// Full-width row for the loading, error and empty states of a table.
// Renders nothing when the table has rows to show.
export default function TableMessageRow({ colSpan, isLoading = false, isEmpty = false, error, loadingText, errorText, emptyText }) {
  if (isLoading) return <TableSkeletonRows colSpan={colSpan} label={loadingText} />

  const message = isEmpty ? (error ? errorText : emptyText) : null
  if (!message) return null

  return (
    <tr>
      <td className="py-10 px-4 text-center text-on-surface-variant" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  )
}
