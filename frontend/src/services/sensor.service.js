import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function listSensors(params) {
  const response = await api.get('/sensors', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getSensor(id) {
  const response = await api.get(`/sensors/${id}`)
  return response.data.data
}

export async function createSensor(body) {
  const response = await api.post('/sensors', body)
  return response.data.data
}

export async function updateSensor(id, body) {
  const response = await api.put(`/sensors/${id}`, body)
  return response.data.data
}

export async function deleteSensor(id) {
  const response = await api.delete(`/sensors/${id}`)
  return response.data.data
}
