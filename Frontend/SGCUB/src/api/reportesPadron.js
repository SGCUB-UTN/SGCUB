import { api } from './conf'
import { errorDetailFrom, saveFileResponse } from './download'

const reportEndpoint = 'padron/reportes/'

const EXPORT_FORMATS = {
  pdf: { path: 'pdf/', type: 'application/pdf', fallbackName: 'reporte-padron.pdf' },
  csv: { path: 'csv/', type: 'text/csv;charset=utf-8', fallbackName: 'reporte-padron.csv' },
}

const LIST_PARAMS = ['age_range', 'seniority', 'gender', 'locality', 'category', 'education', 'coverage', 'health_insurance', 'vaccination', 'documentation']

export const buildReportParams = (filters) => {
  const params = { status: filters.status }
  if (filters.entity) params.entity = filters.entity
  if (filters.age_min !== '') params.age_min = filters.age_min
  if (filters.age_max !== '') params.age_max = filters.age_max
  LIST_PARAMS.forEach((name) => {
    if (filters[name].length) params[name] = filters[name].join(',')
  })
  return params
}

export const getReportePadron = async (filters) => {
  const response = await api.get(reportEndpoint, { params: buildReportParams(filters) })
  return response.data
}

export const downloadReportePadron = async (filters, format) => {
  const { path, type, fallbackName } = EXPORT_FORMATS[format]
  let response
  try {
    response = await api.get(`${reportEndpoint}${path}`, { params: buildReportParams(filters), responseType: 'blob' })
  } catch (requestError) {
    throw await errorDetailFrom(requestError)
  }
  saveFileResponse(response, fallbackName, type)
}
