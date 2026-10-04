import { api } from './api'

export async function listZones(params) {
  const response = await api.get('/zones', { params })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getZone(id) {
  const response = await api.get(`/zones/${id}`)
  return response.data.data
}

export async function createZone(body) {
  const response = await api.post('/zones', body)
  return response.data.data
}

export async function updateZone(id, body) {
  const response = await api.put(`/zones/${id}`, body)
  return response.data.data
}

export async function deleteZone(id) {
  const response = await api.delete(`/zones/${id}`)
  return response.data.data
}
