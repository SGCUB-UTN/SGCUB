import { Modal, Text } from '@mantine/core'

const SHORTCUTS = [
  { keys: ['↑', '↓'], action: 'Moverse entre los resultados' },
  { keys: ['Enter'], action: 'Abrir la ficha del resultado resaltado' },
  { keys: ['.', ','], action: 'Registrar el pago del resultado resaltado' },
  { keys: ['Esc'], action: 'Cerrar los resultados' },
]

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-md border border-outline-variant/60 bg-surface-container-low text-on-surface text-sm font-semibold font-sans">
      {children}
    </kbd>
  )
}

function HelpSection({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      {children}
    </section>
  )
}

export default function HelpModal({ opened, onClose }) {
  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700} size="xl">Ayuda y atajos</Text>} centered size="lg">
      <div className="flex flex-col gap-6 text-base text-on-surface-variant">
        <HelpSection title="Buscar una persona">
          <p>
            Escribí en el buscador de arriba el nombre, el apellido, el DNI sin puntos o el número de socio.
            Los resultados aparecen mientras escribís y el primero queda resaltado.
          </p>
        </HelpSection>

        <HelpSection title="Atajos del buscador">
          <ul className="flex flex-col gap-2">
            {SHORTCUTS.map(({ keys, action }) => (
              <li key={action} className="flex items-center gap-3">
                <span className="flex items-center gap-1 shrink-0 min-w-20">
                  {keys.map((key) => <Kbd key={key}>{key}</Kbd>)}
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </HelpSection>

        <HelpSection title="Cobrar desde cualquier pantalla">
          <p>
            Los botones <strong className="text-on-surface">Pagar</strong> y <strong className="text-on-surface">Otro movimiento</strong> del
            encabezado están siempre disponibles. No hace falta ir a Caja para registrar un pago.
          </p>
        </HelpSection>

        <HelpSection title="Menú lateral">
          <p>
            Con <strong className="text-on-surface">Contraer menú</strong> queda solo la columna de íconos; al pasar el mouse
            se despliega y al salir se vuelve a contraer. En el celular, el menú se abre con el botón de tres líneas.
          </p>
        </HelpSection>

        <HelpSection title="¿Algo no funciona?">
          <p>Avisale a la persona responsable del sistema en el club, contando qué estabas haciendo y qué mensaje apareció.</p>
        </HelpSection>
      </div>
    </Modal>
  )
}
