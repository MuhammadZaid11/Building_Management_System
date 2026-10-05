import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function getEnergySummary(params = {}) {
  const response = await api.get('/energy/summary', { params: cleanParams(params) })
  return response.data.data
}

export async function getEnergyTrend(params = {}) {
  const response = await api.get('/energy/trend', { params: cleanParams(params) })
  return response.data.data
}

export async function getBuildingEnergy(params = {}) {
  const response = await api.get('/energy/buildings', { params: cleanParams(params) })
  return response.data.data
}

export async function getDeviceEnergy(id, params = {}) {
  const response = await api.get(`/energy/devices/${id}`, { params: cleanParams(params) })
  return response.data.data
}

export async function compareEnergy(params = {}) {
  const response = await api.get('/energy/compare', { params: cleanParams(params) })
  return response.data.data
}
