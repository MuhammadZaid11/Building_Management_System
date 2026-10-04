const CLASS_BY_STATUS = {
  ACTIVE: 'badge-active',
  ONLINE: 'badge-online',
  OFFLINE: 'badge-offline',
  MAINTENANCE: 'badge-maintenance',
  DISABLED: 'badge-disabled',
}

export default function StatusBadge({ status }) {
  const tone = CLASS_BY_STATUS[status] || ''

  return <span className={tone ? `badge ${tone}` : 'badge'}>{status}</span>
}
