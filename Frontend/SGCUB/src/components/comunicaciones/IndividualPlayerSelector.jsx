import { useMemo, useState } from 'react'

export default function IndividualPlayerSelector({
  socios = [],
  selectedSocio,
  onSelectSocio,
  contactosSeleccionados,
  onToggleContacto,
  isLoading = false,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Filtrado reactivo de socios reales del backend
  const filteredSocios = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return socios.slice(0, 10) // Mostrar los primeros 10 si no escribe nada
    return socios.filter((s) => {
      const nombreCompleto = `${s.nombre ?? ''} ${s.apellido ?? ''}`.toLowerCase()
      const dni = String(s.dni ?? '')
      const numSocio = String(s.numero_socio ?? '')
      return (
        nombreCompleto.includes(q) ||
        dni.includes(q) ||
        numSocio.includes(q)
      )
    })
  }, [socios, searchQuery])

  // Canales de contacto del socio seleccionado
  const canalesDelSocio = useMemo(() => {
    if (!selectedSocio) return []
    const canales = []

    if (selectedSocio.telefono) {
      canales.push({
        id: 'socio_tel',
        nombre: `${selectedSocio.nombre} ${selectedSocio.apellido}`.trim(),
        tipo: 'Teléfono celular',
        dato: `Tel: ${selectedSocio.telefono}`,
        canal: 'WhatsApp',
      })
    }

    if (selectedSocio.email) {
      canales.push({
        id: 'socio_email',
        nombre: `${selectedSocio.nombre} ${selectedSocio.apellido}`.trim(),
        tipo: 'Correo electrónico',
        dato: `Correo: ${selectedSocio.email}`,
        canal: 'Email',
      })
    }

    return canales
  }, [selectedSocio])

  const iniciales = selectedSocio
    ? `${(selectedSocio.nombre || '')[0] || ''}${(selectedSocio.apellido || '')[0] || ''}`.toUpperCase()
    : 'SC'

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-on-surface">
          Búsqueda de Socio y Ficha de Contacto
        </span>
        <span className="text-xs text-on-surface-variant font-medium">
          Padrón de Socios C.U.B.
        </span>
      </div>

      {/* Buscador de socios reales */}
      <div className="relative">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[20px]">
            person_search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsDropdownOpen(true)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Buscar socio por DNI, Nombre, Apellido o N° de Socio..."
            className="w-full h-10 pl-10 pr-4 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        {/* Dropdown de coincidencias sobre socios reales */}
        {isDropdownOpen && (
          <ul className="absolute z-30 left-0 right-0 top-full mt-1 bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/30 max-h-60 overflow-y-auto divide-y divide-outline-variant/20">
            {isLoading ? (
              <li className="p-3 text-sm text-on-surface-variant text-center">
                Cargando socios del servidor...
              </li>
            ) : socios.length === 0 ? (
              <li className="p-4 text-sm text-on-surface-variant text-center">
                No hay socios cargados en la base de datos todavía.
              </li>
            ) : filteredSocios.length === 0 ? (
              <li className="p-3 text-sm text-on-surface-variant text-center">
                No se encontraron socios que coincidan con "{searchQuery}"
              </li>
            ) : (
              filteredSocios.map((s) => {
                const nombre = `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() || 'Sin nombre'
                const dni = s.dni || 'Sin DNI'
                const num = s.numero_socio ? `Socio #${s.numero_socio}` : 'S/N'
                const tieneContacto = Boolean(s.email || s.telefono)

                return (
                  <li key={s.socio_id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSocio(s)
                        setIsDropdownOpen(false)
                        setSearchQuery(`${dni} - ${nombre}`)
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-surface-container-low flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-on-surface">
                          {nombre}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          DNI {dni} • {num} {s.telefono ? `• Tel: ${s.telefono}` : ''} {s.email ? `• ${s.email}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!tieneContacto && (
                          <span className="text-[11px] bg-error-container text-error px-2 py-0.5 rounded-full font-medium">
                            Sin contacto
                          </span>
                        )}
                        <span className="material-symbols-outlined text-primary text-[20px]">
                          arrow_forward
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>

      {/* Ficha de contactos del socio seleccionado */}
      {selectedSocio ? (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-sm">
                {iniciales}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base text-on-surface">
                  {selectedSocio.nombre} {selectedSocio.apellido}
                </span>
                <span className="text-xs text-on-surface-variant">
                  DNI {selectedSocio.dni} • Socio N° {selectedSocio.numero_socio ?? 'S/N'}
                </span>
              </div>
            </div>
            <span className="text-xs text-secondary bg-surface-container px-2.5 py-0.5 rounded-full font-semibold border border-outline-variant/20">
              {selectedSocio.estado_administrativo_nombre || 'Activo'}
            </span>
          </div>

          <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Canales de contacto habilitados para envío:
          </span>

          {canalesDelSocio.length === 0 ? (
            <div className="p-3 bg-error-container/20 border border-error/30 rounded-lg flex items-center gap-2.5 text-xs text-on-surface">
              <span className="material-symbols-outlined text-error text-[20px] shrink-0">
                warning
              </span>
              <span>
                Este socio <strong>no tiene teléfono ni correo electrónico registrado</strong> en su legajo. Deberá actualizarse en Secretaría para habilitar notificaciones.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {canalesDelSocio.map((canal) => {
                const isChecked = contactosSeleccionados.has(canal.id)
                return (
                  <label
                    key={canal.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-outline-variant/20 bg-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleContacto(canal.id)}
                        className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-on-surface">
                          {canal.nombre}{' '}
                          <span className="text-xs text-on-surface-variant font-normal">
                            ({canal.tipo})
                          </span>
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {canal.dato}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs bg-surface-container text-on-surface-variant px-2.5 py-0.5 rounded-full font-medium border border-outline-variant/20">
                      {canal.canal}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-dashed border-outline-variant/50 rounded-lg p-6 text-center text-sm text-on-surface-variant flex flex-col items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[28px]">
            search
          </span>
          <p className="font-medium text-on-surface">
            Ningún socio seleccionado
          </p>
          <p className="text-xs max-w-sm">
            Escribí el DNI, Nombre o N° de Socio en el buscador de arriba para seleccionar un socio real del padrón.
          </p>
        </div>
      )}
    </div>
  )
}
