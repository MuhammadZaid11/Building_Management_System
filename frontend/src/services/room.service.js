import { api } from './api'

export async function listRooms(params) {
  const response = await api.get('/rooms', { params })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getRoom(id) {
  const response = await api.get(`/rooms/${id}`)
  return response.data.data
}

export async function createRoom(body) {
  const response = await api.post('/rooms', body)
  return response.data.data
}

export async function updateRoom(id, body) {
  const response = await api.put(`/rooms/${id}`, body)
  return response.data.data
}

export async function deleteRoom(id) {
  const response = await api.delete(`/rooms/${id}`)
  return response.data.data
}
