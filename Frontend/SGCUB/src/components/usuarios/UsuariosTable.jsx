import { useMemo, useState } from 'react'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { formatDni, getRoleStyle } from './usuarioFormat'

const filterClass = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm focus:outline-none focus:border-primary cursor-pointer'
const iconButtonClass = 'inline-flex items-center justify-center p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer'

const SORT_VALUES = {
  dni: (usuario) => Number(usuario.dni) || null,
  name: (usuario) => `${usuario.first_name ?? ''} ${usuario.last_name ?? ''}`.trim(),
  role: (usuario) => usuario.role,
  status: (usuario) => (usuario.is_active ? 0 : 1),
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }
const COLUMN_COUNT = 6

function UsuariosTable({ data, roles, isLoading, error, currentUserId, canEdit, onEdit, onResetPassword, onDeactivate, onActivate }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('todos')
  const [status, setStatus] = useState('activo')

  const usuarios = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    const textDigits = text.replace(/\./g, '')
    return usuarios.filter((usuario) => {
      if (status === 'activo' && !usuario.is_active) return false
      if (status === 'baja' && usuario.is_active) return false
      if (role !== 'todos' && usuario.role !== role) return false
      if (!text) return true
      return [usuario.first_name, usuario.last_name, usuario.full_name, usuario.email]
        .some((field) => String(field ?? '').toLowerCase().includes(text))
        || (textDigits !== '' && usuario.dni.includes(textDigits))
    })
  }, [usuarios, search, status, role])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)

  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const resetFilters = () => {
    setSearch('')
    setRole('todos')
    setStatus('activo')
    resetPage()
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Filtrar por DNI, nombre o correo..."
            label="Filtrar usuarios"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <FilterSelect
              className={filterClass}
              value={role}
              onChange={(event) => withPageReset(setRole)(event.target.value)}
              aria-label="Filtrar por rol"
            >
              <option value="todos">Rol: Todos</option>
              {roles.map((roleName) => (
                <option key={roleName} value={roleName}>{roleName}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              className={filterClass}
              value={status}
              onChange={(event) => withPageReset(setStatus)(event.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="activo">Estado: Activo</option>
              <option value="todos">Estado: Todos</option>
              <option value="baja">Dados de baja</option>
            </FilterSelect>
            <button
              type="button"
              onClick={resetFilters}
              title="Restablecer filtros"
              aria-label="Restablecer filtros"
              className="inline-flex items-center justify-center h-10 w-10 shrink-0 rounded border border-outline-variant/40 bg-surface-container-low text-outline hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
            </button>
          </div>
        </div>
      </div>

      <DataTable
        headers={(
          <>
            <SortableHeader className="py-3 px-4 pl-6 w-32 whitespace-nowrap" etiqueta="DNI" columna="dni" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="name" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">Correo</th>
            <SortableHeader className="py-3 px-4" etiqueta="Rol" columna="role" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="status" orden={sort} onOrdenar={sortAndReset} />
            {canEdit && <th className="py-3 px-4 pr-6 text-right" scope="col">Acciones</th>}
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando usuarios..."
          errorText="No se pudieron cargar los usuarios."
          emptyText="No hay usuarios que coincidan con el filtro."
        />

        {!isLoading && visibleRows.map((usuario) => {
          const roleStyle = getRoleStyle(usuario.role)
          const isSelf = usuario.id === currentUserId
          return (
            <tr key={usuario.id} className="hover:bg-surface-container-low/80 transition-colors">
              <td className="py-3 px-4 pl-6 font-semibold text-on-surface text-base whitespace-nowrap">{formatDni(usuario.dni)}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2.5">
                  
                  <span className="font-medium text-on-surface text-base whitespace-nowrap">
                    {usuario.full_name}
                    {isSelf && <span className="ml-2 text-sm font-normal text-on-surface-variant">(vos)</span>}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4 text-on-surface-variant">{usuario.email || '—'}</td>
              <td className="py-3 px-4">
                {usuario.role ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${roleStyle.badge}`}>
                    {usuario.role}
                  </span>
                ) : (
                  <span className="text-on-surface-variant">Sin rol</span>
                )}
              </td>
              <td className="py-3 px-4">
                <ActiveStatusBadge isActive={usuario.is_active} label={usuario.is_active ? 'Activo' : 'Dado de baja'} />
              </td>
              {canEdit && (
                <td className="py-3 px-4 pr-6">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" className={iconButtonClass} onClick={() => onEdit(usuario)} title="Editar datos y rol" aria-label={`Editar a ${usuario.full_name}`}>
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
                    </button>
                    <button type="button" className={iconButtonClass} onClick={() => onResetPassword(usuario)} title="Resetear contraseña" aria-label={`Resetear la contraseña de ${usuario.full_name}`}>
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">lock_reset</span>
                    </button>
                    {usuario.is_active && !isSelf && (
                      <button
                        type="button"
                        onClick={() => onDeactivate(usuario)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-error hover:bg-error-container/60 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_remove</span>
                        Dar de baja
                      </button>
                    )}
                    {!usuario.is_active && (
                      <button
                        type="button"
                        onClick={() => onActivate(usuario)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_check</span>
                        Reactivar
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )
        })}
      </DataTable>

      <TablePagination id="usuarios-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default UsuariosTable
