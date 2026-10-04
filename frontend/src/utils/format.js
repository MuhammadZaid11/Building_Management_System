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
