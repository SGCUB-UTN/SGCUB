// Plain-language description of every task the system runs, keyed by the backend function it executes
export const RECATEGORIZATION_FUNC = 'padron.services.run_recategorization'
export const CATEGORY_UPDATE_FUNC = 'padron.services.pasr_de_anio_vigente_a_categoria'
export const RECATEGORIZATION_REVIEW_PATH = '/automatizaciones/recategorizacion'
export const AREA_ORDER = ['Padrón', 'Finanzas', 'Sistema']

const AUTOMATION_CATALOG = {
  'finanzas.services.generar_cuotas_mensuales': {
    title: 'Generar las cuotas del mes',
    description: 'Crea la cuota mensual de cada socio activo, con sus becas y descuentos.',
    whenOff: 'Si la apagás, no se van a crear las cuotas nuevas y los socios no van a tener la cuota del mes para pagar.',
    icon: 'request_quote',
    area: 'Finanzas',
  },
  'finanzas.services.apply_surcharges': {
    title: 'Aplicar recargos por mora',
    description: 'Suma el recargo a las cuotas vencidas que todavía no se pagaron.',
    whenOff: 'Si la apagás, las cuotas vencidas no van a recibir el recargo por mora.',
    icon: 'payments',
    area: 'Finanzas',
  },
  'finanzas.services.finish_expired_scholarships': {
    title: 'Finalizar becas vencidas',
    description: 'Marca como "Finalizada" cada beca cuya fecha de fin ya pasó. No cambia el monto de las cuotas.',
    whenOff: 'Si la apagás, las becas vencidas van a seguir figurando como "Aplicada" y se van a poder modificar.',
    icon: 'school',
    area: 'Finanzas',
  },
  [CATEGORY_UPDATE_FUNC]: {
    title: 'Actualizar las categorías al nuevo año',
    description: 'Pasa las categorías al año en curso y actualiza el nombre de las infantiles (por ejemplo, "2015" pasa a "2016"). Se hace una vez por año, antes de la recategorización.',
    icon: 'event_repeat',
    area: 'Padrón',
  },
  [RECATEGORIZATION_FUNC]: {
    title: 'Recategorización de jugadores',
    description: 'Asigna a cada jugador la categoría que le corresponde por su año de nacimiento.',
    icon: 'sync',
    area: 'Padrón',
  },
}

export const getAutomationInfo = (automation) => AUTOMATION_CATALOG[automation.func] ?? {
  title: automation.name || automation.automation || 'Tarea del sistema',
  description: 'Tarea interna del sistema.',
  whenOff: 'Si la apagás, esta tarea deja de ejecutarse hasta que la vuelvas a encender.',
  icon: 'schedule',
  area: 'Sistema',
}
