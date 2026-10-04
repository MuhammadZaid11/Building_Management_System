import { hasAnyRole, hasRole } from './roles'

export function canManageInfrastructure(user) {
  return hasAnyRole(user, ['SUPER_ADMIN', 'BUILDING_MANAGER'])
}

export function canDeleteBuilding(user) {
  return hasRole(user, 'SUPER_ADMIN')
}
