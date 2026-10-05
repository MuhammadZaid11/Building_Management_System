export function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatKwh(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }

  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh`
}

export function formatKw(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }

  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} kW`
}

export function formatCost(value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
    return '—'
  }

  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatMoney(value, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }

  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value))
  } catch {
    return `${Number(value).toFixed(2)} ${currency}`
  }
}

export function formatChange(percent) {
  if (percent === null || percent === undefined) {
    return 'No previous baseline'
  }

  const number = Number(percent)
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

export function formatLastSeen(value) {
  if (!value) {
    return 'Never connected'
  }

  return formatDateTime(value)
}

export function formatDeviceLocation(device) {
  const room = device?.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building

  if (!building || !floor || !zone || !room) {
    return '—'
  }

  return `${building.name} → ${floor.name} → ${zone.name} → ${room.name}`
}
