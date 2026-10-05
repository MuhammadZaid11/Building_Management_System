export function formatMetric(value, suffix = '') {
  if (value === null || value === undefined) return 'Not calculated'
  return `${value}${suffix}`
}

export function healthClass(status) {
  return `badge badge-health-${String(status || 'unknown').toLowerCase()}`
}
