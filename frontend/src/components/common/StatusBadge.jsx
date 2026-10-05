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

export function SeverityBadge({ severity }) {
  return <span className={`badge badge-severity-${severity.toLowerCase()}`}>{severity}</span>
}

export function AlarmStatusBadge({ status }) {
  return <span className={`badge badge-alarm-${status.toLowerCase()}`}>{status}</span>
}

export function WorkOrderStatusBadge({ status }) {
  return <span className={`badge badge-work-${String(status || '').toLowerCase().replaceAll('_', '-')}`}>{status}</span>
}

export function DueStateBadge({ status }) {
  return <span className={`badge badge-due-${String(status || '').toLowerCase()}`}>{status}</span>
}
