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
