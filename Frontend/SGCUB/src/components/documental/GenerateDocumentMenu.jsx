import { Menu } from '@mantine/core'
import { SecondaryButton } from '../personas/tabs/parts'

const compareText = new Intl.Collator('es', { sensitivity: 'base' }).compare

export default function GenerateDocumentMenu({ tipos, onSelect }) {
  if (!tipos.length) return null
  const sortedTipos = [...tipos].sort((a, b) => compareText(a.nombre, b.nombre))
  return (
    <Menu position="top-end" shadow="md" width={280}>
      <Menu.Target>
        <SecondaryButton icon="article">Generar documento</SecondaryButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Documentos con plantilla</Menu.Label>
        {sortedTipos.map((tipo) => (
          <Menu.Item
            key={tipo.id_tipo_documento}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">article</span>}
            onClick={() => onSelect(tipo)}
          >
            {tipo.nombre}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
