export function hasRole(user, role) {
  return Boolean(user) && user.role === role
}

export function hasAnyRole(user, roles) {
  return Boolean(user) && roles.includes(user.role)
}
