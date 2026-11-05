import { formatDni, formatPhone } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'

export default function ExcludedListModal({ isOpen, onClose, excludedList = [] }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excluded-modal-title"
    >
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-warning" aria-hidden="true">
              person_off
            </span>
            <div>
              <h2 id="excluded-modal-title" className="text-base font-bold text-on-surface">
                Personas sin datos de contacto ({excludedList.length})
              </h2>
              <p className="text-xs text-on-surface-variant">
                Socios que no poseen correo electrónico o teléfono válido para el envío.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Cerrar listado de excluidos"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {excludedList.length === 0 ? (
            <p className="p-8 text-center text-sm text-on-surface-variant">
              Todas las personas seleccionadas poseen datos de contacto válidos.
            </p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th scope="col">Socio</th>
                  <th scope="col">DNI</th>
                  <th scope="col">Email</th>
                  <th scope="col">Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {excludedList.map((s, idx) => (
                  <tr key={s.socio_id || s.id || idx}>
                    <td className="font-semibold text-on-surface">
                      {s.nombre} {s.apellido}
                    </td>
                    <td className="tabular-nums text-on-surface-variant">
                      {formatDni(s.dni) || '—'}
                    </td>
                    <td className="text-xs">
                      {s.email && s.email.includes('@') ? (
                        <span className="text-on-surface">{s.email}</span>
                      ) : (
                        <span className="text-error font-medium">Faltante</span>
                      )}
                    </td>
                    <td className="text-xs tabular-nums">
                      {s.telefono && String(s.telefono).trim() ? (
                        <span className="text-on-surface">{formatPhone(s.telefono)}</span>
                      ) : (
                        <span className="text-error font-medium">Faltante</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-outline-variant/40 bg-surface-container-low flex justify-end">
          <SecondaryButton type="button" onClick={onClose}>
            Cerrar
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
