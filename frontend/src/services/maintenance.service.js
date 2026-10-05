import { api } from './api'

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
}

export async function getMaintenanceSummary() {
  const response = await api.get('/maintenance/summary')
  return response.data.data
}

export async function listTechnicians() {
  const response = await api.get('/maintenance/technicians')
  return response.data.data
}

export async function listWorkOrders(params) {
  const response = await api.get('/maintenance/work-orders', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function getWorkOrder(id) {
  const response = await api.get(`/maintenance/work-orders/${id}`)
  return response.data.data
}

export async function createWorkOrder(body) {
  const response = await api.post('/maintenance/work-orders', body)
  return response.data.data
}

export async function assignWorkOrder(id, assignedToId) {
  const response = await api.patch(`/maintenance/work-orders/${id}/assign`, { assignedToId })
  return response.data.data
}

export async function startWorkOrder(id) {
  const response = await api.patch(`/maintenance/work-orders/${id}/start`)
  return response.data.data
}

export async function holdWorkOrder(id) {
  const response = await api.patch(`/maintenance/work-orders/${id}/hold`)
  return response.data.data
}

export async function resumeWorkOrder(id) {
  const response = await api.patch(`/maintenance/work-orders/${id}/resume`)
  return response.data.data
}

export async function completeWorkOrder(id, body) {
  const response = await api.patch(`/maintenance/work-orders/${id}/complete`, body)
  return response.data.data
}

export async function cancelWorkOrder(id) {
  const response = await api.patch(`/maintenance/work-orders/${id}/cancel`)
  return response.data.data
}

export async function addWorkOrderActivity(id, body) {
  const response = await api.post(`/maintenance/work-orders/${id}/activities`, body)
  return response.data.data
}

export async function listSchedules(params) {
  const response = await api.get('/maintenance/schedules', { params: cleanParams(params) })
  return { items: response.data.data, pagination: response.data.pagination }
}

export async function createSchedule(body) {
  const response = await api.post('/maintenance/schedules', body)
  return response.data.data
}

export async function deleteSchedule(id) {
  const response = await api.delete(`/maintenance/schedules/${id}`)
  return response.data.data
}
