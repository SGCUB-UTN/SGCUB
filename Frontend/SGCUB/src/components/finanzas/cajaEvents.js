export const CAJA_CHANGED_EVENT = 'cajaCambiada'

export const notifyCajaChanged = () => window.dispatchEvent(new Event(CAJA_CHANGED_EVENT))
