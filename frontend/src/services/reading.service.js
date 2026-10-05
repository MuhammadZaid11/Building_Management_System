import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function listReadings(params) {
  const response = await api.get('/readings', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getReading(id) {
  const response = await api.get(`/readings/${id}`)
  return response.data.data
}

export async function createReading(body) {
  const response = await api.post('/readings', body)
  return response.data.data
}
