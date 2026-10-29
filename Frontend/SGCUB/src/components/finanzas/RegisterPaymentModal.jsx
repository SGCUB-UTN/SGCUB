import { useEffect, useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { getSocio } from '../../api/socios'
import { getEstadoCuenta } from '../../api/estadoCuenta'
import useAssignBenefit from '../../hooks/useAssignBenefit'
import { formatDni, formatNumber, isActiveStatus } from '../personas/format'
import { BenefitButton } from '../personas/HeaderPersona'
import PagoForm from './PagoForm'
import SocioPicker from './SocioPicker'

const EMPTY_LOAD = { socioId: null, socio: null, cuenta: null, error: '' }

function HeaderMessage({ icon, tone = 'text-on-surface-variant', spin = false, children }) {
  return (
    <p className={`flex items-center gap-2 h-10 text-base ${tone}`} role={tone === 'text-error' ? 'alert' : 'status'}>
      <span className={`material-symbols-outlined text-[20px] ${spin ? 'animate-spin' : ''}`} aria-hidden="true">{icon}</span>
      {children}
    </p>
  )
}

// Always shows the payment form layout. Until a valid socio is loaded the form is empty and the
// modal header holds the socio search (or the loading / error state); then the sections fill in.
// Without `initialSocioId` the modal starts with the search.
// With `onChangeOption` it settles a payment just reverted: it can't be closed until the payment is
// registered, only left to choose another option. `excludedSocioId` can't be picked (the wrong socio).
function RegisterPaymentModal({
  opened,
  initialSocioId = null,
  initialCuotaIds,
  reversal = null,
  excludedSocioId = null,
  onChangeOption = null,
  onClose,
  onSuccess,
}) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [socioId, setSocioId] = useState(initialSocioId)
  const [load, setLoad] = useState(EMPTY_LOAD)
  const [paid, setPaid] = useState(false)
  const locked = Boolean(onChangeOption) && !paid
  const canChangeSocio = !reversal || reversal.otherSocio
  const { openBenefit } = useAssignBenefit()

  useEffect(() => {
    if (!opened || !socioId) return undefined
    let active = true
    Promise.all([getSocio(socioId), getEstadoCuenta(socioId)])
      .then(([socio, cuenta]) => active && setLoad({ socioId, socio, cuenta, error: '' }))
      .catch(() => active && setLoad({ socioId, socio: null, cuenta: null, error: 'No se pudo cargar la cuenta corriente del socio.' }))
    return () => { active = false }
  }, [opened, socioId])

  const reloadAccount = (loadedSocioId) => getEstadoCuenta(loadedSocioId)
    .then((cuenta) => setLoad((current) => (current.socioId === loadedSocioId ? { ...current, cuenta } : current)))
    .catch(() => {})

  const refreshAccount = () => {
    reloadAccount(load.socioId)
    onSuccess?.()
  }

  const assignBenefit = (cuotaId = null) => openBenefit({ socioId: load.socioId, cuotaId, onSuccess: refreshAccount })

  const loading = Boolean(socioId) && load.socioId !== socioId
  const loaded = Boolean(socioId) && !loading && !load.error && load.socio && load.cuenta
  const ready = loaded && isActiveStatus(load.socio.estado_administrativo_nombre)

  const socioSummary = () => {
    if (ready) {
      const socio = load.socio
      return (
        <p className="min-w-0 truncate text-base text-on-surface-variant">
          <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
          {' '}(DNI {formatDni(socio.dni)} • Socio {formatNumber(socio.numero_socio)})
        </p>
      )
    }
    if (!socioId) return <SocioPicker compact excludedId={excludedSocioId} onSelect={(socio) => setSocioId(socio.socio_id)} />
    if (loading) return <HeaderMessage icon="progress_activity" spin>Cargando estado de cuenta...</HeaderMessage>
    if (!loaded) {
      return <HeaderMessage icon="error" tone="text-error">{load.error || 'No se encontró la cuenta corriente del socio.'}</HeaderMessage>
    }
    return <HeaderMessage icon="person_off" tone="text-error">El socio está dado de baja. No se pueden registrar pagos a socios inactivos.</HeaderMessage>
  }

  const handleSuccess = (response) => {
    setPaid(true)
    onSuccess?.(response)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={!locked}
      closeOnEscape={!locked}
      closeOnClickOutside={!locked}
      aria-label="Registrar pago"
      title={(
        <div className="flex items-center gap-4 min-w-0">
          {locked && (
            <>
              <button
                type="button"
                onClick={onChangeOption}
                className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>
                Cambiar opción
              </button>
              <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
            </>
          )}
          <button
            type="button"
            onClick={() => setSocioId(null)}
            disabled={!socioId || !canChangeSocio || paid}
            className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:grayscale disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
            Elegir otro socio
          </button>
          <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">{socioSummary()}</div>
          <BenefitButton onClick={() => assignBenefit()} disabled={!ready} />
        </div>
      )}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(1240px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
    >
      {ready ? (
        // Keyed by socio so the selection state starts fresh for each one
        <PagoForm
          key={load.socio.socio_id}
          socio={load.socio}
          cuenta={load.cuenta}
          initialCuotaIds={initialCuotaIds}
          reversal={reversal}
          onCancel={onClose}
          onSuccess={handleSuccess}
          onAssignBenefit={assignBenefit}
          onAccountChanged={refreshAccount}
        />
      ) : (
        <PagoForm key="empty" onCancel={onClose} />
      )}
    </Modal>
  )
}

export default RegisterPaymentModal
