import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

async function getReport(path, params) {
  const response = await api.get(path, { params: cleanParams(params) })
  return response.data.data
}

export function getExecutiveSummary(params) {
  return getReport('/reports/executive-summary', params)
}

export function getBuildingHealth(params) {
  return getReport('/reports/building-health', params)
}

export function getDeviceStatusReport(params) {
  return getReport('/reports/device-status', params)
}

export function getAlarmTrends(params) {
  return getReport('/reports/alarm-trends', params)
}

export function getEnergyTrends(params) {
  return getReport('/reports/energy-trends', params)
}

export function getMaintenanceKpis(params) {
  return getReport('/reports/maintenance-kpis', params)
}

export function getBuildingComparison(params) {
  return getReport('/reports/buildings', params)
}
