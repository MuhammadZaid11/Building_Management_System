import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function listAlarms(params) {
  const response = await api.get('/alarms', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getAlarm(id) {
  const response = await api.get(`/alarms/${id}`)
  return response.data.data
}

export async function acknowledgeAlarm(id) {
  const response = await api.patch(`/alarms/${id}/acknowledge`)
  return response.data.data
}

export async function resolveAlarm(id) {
  const response = await api.patch(`/alarms/${id}/resolve`)
  return response.data.data
}

export async function getAlarmSummary() {
  const response = await api.get('/alarms/summary')
  return response.data.data
}
