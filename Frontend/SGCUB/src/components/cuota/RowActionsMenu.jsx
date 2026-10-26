import { Menu } from '@mantine/core'

const MENU_STYLES = {
  dropdown: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
  },
  item: {
    color: 'var(--color-on-surface)',
    fontSize: 14,
    '&[data-hovered]': { backgroundColor: 'var(--color-surface-container-low)' },
  },
  divider: { borderColor: 'var(--color-outline-variant)' },
}

const TRIGGER_CLASS = 'w-9 h-9 flex items-center justify-center rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

const Icon = ({ name }) => (
  <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">{name}</span>
)

export default function RowActionsMenu({ label, onAssignBenefit, onEdit, onDelete }) {
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={220} styles={MENU_STYLES}>
      <Menu.Target>
        <button type="button" className={TRIGGER_CLASS} aria-label={`Más acciones para ${label}`} title="Más acciones">
          <Icon name="more_vert" />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item icon={<Icon name="sell" />} onClick={onAssignBenefit}>Asignar beneficio</Menu.Item>
        <Menu.Item icon={<Icon name="edit_calendar" />} onClick={onEdit}>Editar vencimientos</Menu.Item>
        <Menu.Divider />
        <Menu.Item icon={<Icon name="delete" />} onClick={onDelete} style={{ color: 'var(--color-error)' }}>
          Eliminar cuota
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
