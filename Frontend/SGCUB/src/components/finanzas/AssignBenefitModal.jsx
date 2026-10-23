import { useEffect, useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { getEstadoCuenta } from '../../api/estadoCuenta'
import { getSocio } from '../../api/socios'
import { formatDni, formatNumber } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import BenefitForm from './BenefitForm'
import { isOpen } from './benefitMath'
import QuickDiscountForm from './QuickDiscountForm'

const EMPTY_LOAD = { socioId: null, socio: null, cuenta: null, error: '' }

const MODAL_Z_INDEX = 300

function HeaderMessage({ icon, tone = 'text-on-surface-variant', spin = false, children }) {
  return (
    <span className={`flex items-center gap-2 text-base font-normal ${tone}`} role={tone === 'text-error' ? 'alert' : 'status'}>
      <span className={`material-symbols-outlined text-[20px] ${spin ? 'animate-spin' : ''}`} aria-hidden="true">{icon}</span>
      {children}
    </span>
  )
}

function AssignBenefitModal({ opened, socioId, cuotaId, onClose, onSuccess }) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [load, setLoad] = useState(EMPTY_LOAD)

  useEffect(() => {
    if (!opened || !socioId) return undefined
    let active = true
    Promise.all([getSocio(socioId), getEstadoCuenta(socioId)])
      .then(([socio, cuenta]) => active && setLoad({ socioId, socio, cuenta, error: '' }))
      .catch(() => active && setLoad({ socioId, socio: null, cuenta: null, error: 'No se pudo cargar la cuenta corriente del socio.' }))
    return () => { active = false }
  }, [opened, socioId])

  const handleSuccess = () => {
    onSuccess?.()
    onClose()
  }

  const loading = load.socioId !== socioId
  const ready = !loading && !load.error && load.socio && load.cuenta
  const socio = load.socio
  const quick = Boolean(cuotaId)
  const cuota = quick ? load.cuenta?.cuotas?.find((item) => item.cuota_id === cuotaId) ?? null : null

  const statusMessage = loading
    ? <HeaderMessage icon="progress_activity" spin>Cargando estado de cuenta...</HeaderMessage>
    : <HeaderMessage icon="error" tone="text-error">{load.error || 'No se encontró la cuenta corriente del socio.'}</HeaderMessage>

  const quickTitle = (
    <div className="flex flex-col min-w-0">
      <span className="text-lg font-bold text-on-surface">Descuento{cuota ? ` · Cuota ${formatPeriod(cuota.periodo)}` : ''}</span>
      {ready ? <span className="truncate text-sm font-normal text-on-surface-variant">{socio.apellido}, {socio.nombre}</span> : statusMessage}
    </div>
  )

  const quickBody = () => {
    if (!ready) return null
    if (!cuota) return <HeaderMessage icon="error" tone="text-error">No se encontró la cuota.</HeaderMessage>
    if (!isOpen(cuota)) return <HeaderMessage icon="task_alt">La cuota ya está paga: no admite descuentos.</HeaderMessage>
    return <QuickDiscountForm cuota={cuota} onSuccess={handleSuccess} />
  }

  const title = (
    <div className="flex items-center gap-4 min-w-0">
      <span className="shrink-0 text-sm uppercase tracking-wider font-semibold text-primary">Asignar beca o descuento</span>
      <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {ready ? (
          <p className="truncate text-base text-on-surface-variant">
            <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
            {' '}(DNI {formatDni(socio.dni)} • Socio {formatNumber(socio.numero_socio)})
          </p>
        ) : statusMessage}
      </div>
    </div>
  )

  return quick ? (
    <Modal
      opened={opened}
      onClose={onClose}
      title={quickTitle}
      styles={{ title: { flex: 1, minWidth: 0 } }}
      size="md"
      fullScreen={isMobile}
      centered
      padding="lg"
      zIndex={MODAL_Z_INDEX}
    >
      {quickBody()}
    </Modal>
  ) : (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(1100px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
      zIndex={MODAL_Z_INDEX}
    >
      {ready ? (
        <BenefitForm socio={load.socio} cuenta={load.cuenta} onSuccess={handleSuccess} />
      ) : (
        <BenefitForm key="empty" />
      )}
    </Modal>
  )
}

export default AssignBenefitModal
