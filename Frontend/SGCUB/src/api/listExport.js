import { api } from './conf'
import { errorDetailFrom, savePdfResponse } from './download'

export const downloadListPdf = async ({ title, filename, description, columns, rows }) => {
  try {
    const response = await api.post(
      'padron/listado/pdf/',
      { titulo: title, archivo: filename, descripcion: description, columnas: columns, filas: rows },
      { responseType: 'blob' },
    )
    savePdfResponse(response, `${filename}.pdf`)
  } catch (error) {
    throw await errorDetailFrom(error)
  }
}
