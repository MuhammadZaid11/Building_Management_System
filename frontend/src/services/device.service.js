import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function listDevices(params) {
  const response = await api.get('/devices', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getDevice(id) {
  const response = await api.get(`/devices/${id}`)
  return response.data.data
}

export async function createDevice(body) {
  const response = await api.post('/devices', body)
  return response.data.data
}

export async function updateDevice(id, body) {
  const response = await api.put(`/devices/${id}`, body)
  return response.data.data
}

export async function deleteDevice(id) {
  const response = await api.delete(`/devices/${id}`)
  return response.data.data
}
