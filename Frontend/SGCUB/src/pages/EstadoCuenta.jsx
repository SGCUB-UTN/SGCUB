import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatDni, formatNumber, isActiveStatus } from '../components/personas/format'
import PageHeader from '../components/shared/PageHeader'
import FinancialTab from '../components/personas/tabs/FinancialTab'
import useSocio from '../hooks/useSocio'
import { matchesSearch } from '../components/shared/search'

function EstadoCuenta() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { socios, isLoading, error } = useSocio()
  const [busqueda, setBusqueda] = useState('')
  const [socioSeleccionado, setSocioSeleccionado] = useState(null)
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const socioInicialId = searchParams.get('socio')

  useEffect(() => {
    if (socioInicialId && socios.length) {
      const socioInicial = socios.find((socio) => String(socio.socio_id) === String(socioInicialId))
      if (socioInicial) {
        setSocioSeleccionado(socioInicial)
        setBuscandoSocio(false)
      }
    }
  }, [socioInicialId, socios])

  const resultados = useMemo(() => {
    const termino = busqueda.trim()
    if (!termino) return []
    return socios
      .filter((socio) => matchesSearch(termino, [
        socio.dni,
        socio.numero_socio,
        socio.nombre,
        socio.apellido,
        `${socio.nombre} ${socio.apellido}`,
        `${socio.apellido} ${socio.nombre}`,
      ]))
      .slice(0, 8)
  }, [busqueda, socios])

  const seleccionarSocio = (socio) => {
    setSocioSeleccionado(socio)
    setBusqueda('')
    setBuscandoSocio(false)
    setSearchParams({ socio: String(socio.socio_id) }, { replace: true })
  }

  const mostrarBuscador = !socioSeleccionado || buscandoSocio

  return (
    <div className="w-full flex flex-col gap-4 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Estado de cuenta' }]}
        title="Consulta de estado de cuenta"
      />

      <section
        className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3.5 shadow-sm"
        aria-label="Selector de socio"
      >
        {!mostrarBuscador && socioSeleccionado ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">person</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-on-surface truncate">
                    {socioSeleccionado.apellido}, {socioSeleccionado.nombre}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      isActiveStatus(socioSeleccionado.estado_administrativo_nombre)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-surface-container-high text-on-surface-variant border-outline-variant/40'
                    }`}
                  >
                    {socioSeleccionado.estado_administrativo_nombre || 'Socio'}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">
                  DNI {formatDni(socioSeleccionado.dni)} · Socio #{formatNumber(socioSeleccionado.numero_socio)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setBuscandoSocio(true)
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm font-semibold text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>
                Cambiar socio
              </button>
              <button
                type="button"
                onClick={() => navigate(`/padron/socios/${socioSeleccionado.socio_id}`)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-outline-variant/40 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
                Ver ficha
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">manage_search</span>
                <label htmlFor="estado-cuenta-search" className="text-sm font-bold uppercase tracking-wider text-on-surface">
                  Buscar socio
                </label>
              </div>
              <div className="relative flex-1 min-w-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]" aria-hidden="true">
                  search
                </span>
                <input
                  id="estado-cuenta-search"
                  autoFocus
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && socioSeleccionado) {
                      setBuscandoSocio(false)
                      setBusqueda('')
                    }
                  }}
                  className="w-full h-10 pl-10 pr-4 bg-surface-container-low border border-outline-variant/40 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Nombre, apellido, DNI o número de socio..."
                  aria-label="Buscar socio por nombre, apellido, DNI o número de socio"
                />
                {resultados.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 border border-outline-variant/30 rounded-lg overflow-hidden divide-y divide-outline-variant/20 bg-surface-container-lowest shadow-lg max-h-72 overflow-y-auto">
                    {resultados.map((socio) => (
                      <button
                        key={socio.socio_id}
                        type="button"
                        onClick={() => seleccionarSocio(socio)}
                        className="w-full flex items-center justify-between gap-4 px-3.5 py-2.5 text-left bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer"
                      >
                        <span className="min-w-0">
                          <strong className="block text-sm text-on-surface truncate">
                            {socio.apellido}, {socio.nombre}
                          </strong>
                          <span className="text-xs text-on-surface-variant">
                            DNI {formatDni(socio.dni)} · Socio #{formatNumber(socio.numero_socio)}
                          </span>
                        </span>
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0" aria-hidden="true">
                          chevron_right
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {socioSeleccionado && (
                <button
                  type="button"
                  onClick={() => {
                    setBuscandoSocio(false)
                    setBusqueda('')
                  }}
                  className="shrink-0 h-10 px-3 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
            {isLoading && <p className="text-xs text-on-surface-variant">Cargando socios...</p>}
            {error && <p className="text-xs text-error" role="alert">No se pudieron cargar los socios.</p>}
            {!isLoading && busqueda.trim() && resultados.length === 0 && (
              <p className="text-xs text-on-surface-variant">No encontramos socios con ese criterio.</p>
            )}
          </div>
        )}
      </section>

      {socioSeleccionado ? (
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <FinancialTab socio={socioSeleccionado} />
        </section>
      ) : (
        <div className="py-14 flex flex-col items-center text-center gap-2.5 text-on-surface-variant border border-dashed border-outline-variant/40 rounded-xl">
          <span className="material-symbols-outlined text-4xl text-outline" aria-hidden="true">account_balance_wallet</span>
          <h2 className="text-base font-semibold text-on-surface">Seleccioná un socio en el buscador superior</h2>
          <p className="text-sm">El detalle de cuotas, saldo a favor, otros movimientos y becas aparecerá aquí.</p>
        </div>
      )}
    </div>
  )
}

export default EstadoCuenta