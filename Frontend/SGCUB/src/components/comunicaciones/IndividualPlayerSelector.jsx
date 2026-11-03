import { useMemo, useState } from 'react'
import { formatDni, formatPhone } from '../personas/format'
import TableSearchInput from '../shared/TableSearchInput'

export default function IndividualPlayerSelector({
  socios = [],
  selectedSocio,
  onSelectSocio,
  canales,
  setCanales,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSocios = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return socios
      .filter((s) => {
        const nombreCompleto = `${s.nombre || ''} ${s.apellido || ''}`.toLowerCase()
        const dni = String(s.dni || '').toLowerCase()
        const nro = String(s.numero_socio || '').toLowerCase()
        return nombreCompleto.includes(query) || dni.includes(query) || nro.includes(query)
      })
      .slice(0, 8)
  }, [socios, searchQuery])

  const hasEmail = Boolean(selectedSocio?.email && selectedSocio.email.includes('@'))
  const hasWhatsapp = Boolean(selectedSocio?.telefono && String(selectedSocio.telefono).trim().length > 0)

  const handleSelect = (socio) => {
    const socioHasEmail = Boolean(socio?.email && socio.email.includes('@'))
    onSelectSocio(socio)
    setCanales({
      email: socioHasEmail,
      whatsapp: false,
    })
    setSearchQuery('')
  }

  return (
    <div className="border border-outline-variant/40 rounded-lg bg-surface-container-lowest p-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-on-surface">Destinatario individual</h4>
          <p className="text-xs text-on-surface-variant">
            Buscá al socio o jugador por nombre, apellido, DNI o número de socio.
          </p>
        </div>
        <TableSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nombre, DNI o N° socio..."
          className="w-full sm:w-80"
        />
      </div>

      {searchQuery.trim() && (
        <div className="border border-outline-variant/50 rounded-lg bg-surface-container-lowest divide-y divide-outline-variant/30 max-h-60 overflow-y-auto shadow-xs">
          {filteredSocios.length === 0 ? (
            <p className="p-4 text-center text-sm text-on-surface-variant">
              No se encontraron socios para "{searchQuery}".
            </p>
          ) : (
            filteredSocios.map((s) => {
              const sEmail = Boolean(s.email && s.email.includes('@'))
              const sPhone = Boolean(s.telefono && String(s.telefono).trim().length > 0)
              return (
                <button
                  key={s.socio_id || s.id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full px-4 py-2.5 text-left hover:bg-surface-container-low flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {s.nombre} {s.apellido}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      DNI {formatDni(s.dni)}
                      {s.numero_socio ? ` · Socio #${s.numero_socio}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        sEmail ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant/60'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">mail</span>
                      {sEmail ? 'Email' : 'Sin email'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        sPhone ? 'bg-success/10 text-success' : 'bg-surface-container text-on-surface-variant/60'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">chat</span>
                      {sPhone ? 'WhatsApp' : 'Sin tel.'}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {selectedSocio ? (
        <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/40 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-primary/12 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {(selectedSocio.nombre?.[0] || '') + (selectedSocio.apellido?.[0] || '')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">
                  {selectedSocio.nombre} {selectedSocio.apellido}
                </p>
                <p className="text-xs text-on-surface-variant">
                  DNI {formatDni(selectedSocio.dni)}
                  {selectedSocio.numero_socio ? ` · Socio #${selectedSocio.numero_socio}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectSocio(null)}
              className="text-xs font-medium text-on-surface-variant hover:text-error flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
              Cambiar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-outline-variant/30">
            <label
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                !hasEmail
                  ? 'border-outline-variant/30 bg-surface-container/50 opacity-60 cursor-default'
                  : canales.email
                    ? 'border-primary bg-primary/8 cursor-pointer'
                    : 'border-outline-variant/40 bg-surface-container-lowest cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  disabled={!hasEmail}
                  checked={hasEmail && canales.email}
                  onChange={() => hasEmail && setCanales((prev) => ({ ...prev, email: !prev.email }))}
                  className="w-4 h-4 rounded accent-primary cursor-default"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface">Correo electrónico</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {hasEmail ? selectedSocio.email : 'Sin correo registrado'}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
                mail
              </span>
            </label>

            <div
              aria-disabled="true"
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-outline-variant/30 bg-surface-container/50 opacity-60 cursor-default select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  readOnly
                  className="w-4 h-4 rounded cursor-default"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-on-surface-variant">WhatsApp</p>
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] font-semibold text-on-surface-variant">
                      No configurado
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">
                    {hasWhatsapp ? formatPhone(selectedSocio.telefono) : 'Sin teléfono registrado'}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0" aria-hidden="true">
                chat
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-5 px-4 rounded-lg border border-dashed border-outline-variant/50 text-center text-xs text-on-surface-variant">
          Todavía no seleccionaste ningún socio destinatario. Usá el buscador superior para elegirlo.
        </div>
      )}
    </div>
  )
}
