import { Modal, Text } from '@mantine/core'
import DataTable from '../shared/DataTable'
import { formatCount, formatMoney } from '../cuota/cuotaPeriod'

const HEADER_CLASS = 'px-4 py-3'

export default function AffectedCategoriesModal({ opened, onClose, categories }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Categorías con morosidad</Text>}
      centered
      size="lg"
    >
      <div className="max-h-[60vh] overflow-auto border border-outline-variant/30 rounded-lg">
        <DataTable
          headers={(
            <>
              <th className={HEADER_CLASS} scope="col">Categoría</th>
              <th className={`${HEADER_CLASS} text-right`} scope="col">Cantidad de morosos</th>
              <th className={`${HEADER_CLASS} text-right`} scope="col">Monto total</th>
            </>
          )}
        >
          {categories.map((category) => (
            <tr key={category.nombre} className="hover:bg-surface-container-low/70">
              <td className="px-4 py-3 font-semibold text-on-surface">{category.nombre}</td>
              <td className="px-4 py-3 text-right">{formatCount(category.morosos)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-error">{formatMoney(category.monto)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </Modal>
  )
}
