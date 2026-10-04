export default function StatusBadge({ status }) {
  const active = status === 'ACTIVE'

  return <span className={active ? 'badge badge-active' : 'badge'}>{status}</span>
}
