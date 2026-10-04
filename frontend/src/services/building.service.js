import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function listBuildings(params) {
  const response = await api.get('/buildings', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getBuilding(id) {
  const response = await api.get(`/buildings/${id}`)
  return response.data.data
}

export async function createBuilding(body) {
  const response = await api.post('/buildings', body)
  return response.data.data
}

export async function updateBuilding(id, body) {
  const response = await api.put(`/buildings/${id}`, body)
  return response.data.data
}

export async function deleteBuilding(id) {
  const response = await api.delete(`/buildings/${id}`)
  return response.data.data
}
