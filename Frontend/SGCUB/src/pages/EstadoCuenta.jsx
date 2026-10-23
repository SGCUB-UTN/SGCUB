import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatDni, formatNumber } from '../components/personas/format'
import PageHeader from '../components/shared/PageHeader'
import FinancialTab from '../components/personas/tabs/FinancialTab'
import useSocio from '../hooks/useSocio'
import { matchesSearch } from '../components/shared/search'

function EstadoCuenta() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socios, isLoading, error } = useSocio()
  const [busqueda, setBusqueda] = useState('')
  const [socioSeleccionado, setSocioSeleccionado] = useState(null)
  const socioInicialId = searchParams.get('socio')

  useEffect(() => {
    if (!socioSeleccionado && socioInicialId && socios.length) {
      const socioInicial = socios.find((socio) => String(socio.socio_id) === String(socioInicialId))
      if (socioInicial) setSocioSeleccionado(socioInicial)
    }
  }, [socioInicialId, socios, socioSeleccionado])

  const resultados = useMemo(() => {
    const termino = busqueda.trim()
    if (!termino) return []
    return socios.filter((socio) => matchesSearch(termino, [socio.dni, socio.numero_socio, socio.nombre, socio.apellido])).slice(0, 8)
  }, [busqueda, socios])

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader breadcrumb={[{ label: 'Finanzas' }, { label: 'Estado de cuenta' }]} title="Consulta de estado de cuenta" />

      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm" aria-labelledby="buscar-socio-title">
        <div className="flex items-start gap-3 mb-4">
          <span className="material-symbols-outlined text-primary text-2xl">manage_search</span>
          <div><h2 id="buscar-socio-title" className="text-lg font-bold text-on-surface">Buscar socio</h2><p className="text-base text-on-surface-variant">Buscá por DNI o número de socio para consultar su situación financiera.</p></div>
        </div>
        <div className="relative max-w-2xl">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input autoFocus value={busqueda} onChange={(event) => setBusqueda(event.target.value)} className="w-full h-11 pl-10 pr-4 bg-surface-container-low border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none focus:border-primary" placeholder="DNI o número de socio" aria-label="Buscar socio por DNI o número de socio" />
        </div>
        {isLoading && <p className="mt-3 text-sm text-on-surface-variant">Cargando socios...</p>}
        {error && <p className="mt-3 text-sm text-error" role="alert">No se pudieron cargar los socios.</p>}
        {resultados.length > 0 && (
          <div className="mt-3 max-w-2xl border border-outline-variant/30 rounded-lg overflow-hidden divide-y divide-outline-variant/20">
            {resultados.map((socio) => <button key={socio.socio_id} type="button" onClick={() => { setSocioSeleccionado(socio); setBusqueda(`${socio.nombre} ${socio.apellido}`) }} className="w-full flex items-center justify-between gap-4 p-3 text-left bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer"><span><strong className="block text-on-surface">{socio.apellido}, {socio.nombre}</strong><span className="text-sm text-on-surface-variant">DNI {formatDni(socio.dni)} · Socio {formatNumber(socio.numero_socio)}</span></span><span className="material-symbols-outlined text-primary">chevron_right</span></button>)}
          </div>
        )}
        {!isLoading && busqueda.trim() && resultados.length === 0 && !socioSeleccionado && <p className="mt-3 text-sm text-on-surface-variant">No encontramos socios con ese criterio.</p>}
      </section>

      {socioSeleccionado ? (
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-surface-container">
            <div><p className="text-sm uppercase tracking-wider font-semibold text-primary">Socio seleccionado</p><h2 className="text-2xl font-bold text-on-surface">{socioSeleccionado.apellido}, {socioSeleccionado.nombre}</h2><p className="text-base text-on-surface-variant">DNI {formatDni(socioSeleccionado.dni)} · Socio {formatNumber(socioSeleccionado.numero_socio)}</p></div>
            <button type="button" onClick={() => navigate(`/padron/socios/${socioSeleccionado.socio_id}`)} className="inline-flex items-center gap-2 h-10 px-4 border border-outline-variant/40 rounded-lg text-on-surface font-semibold hover:bg-surface-container-low cursor-pointer"><span className="material-symbols-outlined text-[19px]">person</span>Ver ficha</button>
          </div>
          <FinancialTab socio={socioSeleccionado} />
        </section>
      ) : (
        <div className="py-16 flex flex-col items-center text-center gap-3 text-on-surface-variant border border-dashed border-outline-variant/40 rounded-xl"><span className="material-symbols-outlined text-4xl text-outline">account_balance_wallet</span><h2 className="text-lg font-semibold text-on-surface">Seleccioná un socio</h2><p>El detalle de cuotas y deuda aparecerá aquí.</p></div>
      )}
    </div>
  )
}

export default EstadoCuenta