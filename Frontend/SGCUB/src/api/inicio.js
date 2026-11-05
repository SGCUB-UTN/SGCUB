import { api } from './conf'

export const getResumenInicio = async () => {
  const response = await api.get('inicio/resumen/')
  return response.data
}
