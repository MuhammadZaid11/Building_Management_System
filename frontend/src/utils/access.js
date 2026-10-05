import { hasAnyRole, hasRole } from './roles'

export function canManageInfrastructure(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER'])
}

export function canDeleteBuilding(user) {
  return hasRole(user, 'SUPER_ADMIN')
}

export function canManageDevices(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'])
}

export function canUpdateDeviceStatus(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'TECHNICIAN'])
}

export function canManageSensors(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'])
}

export function canCreateReadings(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'FACILITY_MANAGER', 'TECHNICIAN'])
}

export function canOperateAlarms(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'TECHNICIAN'])
}

export function canManageMaintenance(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'])
}

export function canExecuteMaintenance(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'TECHNICIAN'])
}

export function canWorkOnOrder(user, workOrder) {
  if (!user || !workOrder) return false
  if (canManageMaintenance(user)) return true
  return user.role === 'TECHNICIAN' && workOrder.assignedTo?.id === user.id
}
