import { api } from './api'

export async function listFloors(params) {
  const response = await api.get('/floors', { params })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getFloor(id) {
  const response = await api.get(`/floors/${id}`)
  return response.data.data
}

export async function createFloor(body) {
  const response = await api.post('/floors', body)
  return response.data.data
}

export async function updateFloor(id, body) {
  const response = await api.put(`/floors/${id}`, body)
  return response.data.data
}

export async function deleteFloor(id) {
  const response = await api.delete(`/floors/${id}`)
  return response.data.data
}
