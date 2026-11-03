import JugadorEducationChart from './JugadorEducationChart'
import StatCard from '../shared/StatCard'

export default function JugadorHealthEducationSummary({ jugadores, isLoading, error }) {
  const jugadoresActivos = jugadores.filter((jugador) => {
    const estado = (jugador.estado?.nombre ?? '').toLowerCase()
    return estado.includes('activo') && !estado.includes('baja') && !estado.includes('inactivo')
  })
  const vacunados = jugadoresActivos.filter((jugador) => jugador.esquema_vacunacion === true).length

  return (
    <>
      <StatCard
        label="Jugadores vacunados"
        value={isLoading ? '…' : error ? '—' : vacunados.toLocaleString('es-AR')}
        caption={!isLoading && !error ? `de ${jugadoresActivos.length.toLocaleString('es-AR')} jugadores activos` : undefined}
        icon="vaccines"
        tone="positive"
      />
      <JugadorEducationChart jugadores={jugadoresActivos} isLoading={isLoading} error={error} />
    </>
  )
}
