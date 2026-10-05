import { useSocket } from '../../hooks/useSocket'

const LABELS = {
  connected: 'Live',
  connecting: 'Reconnecting...',
  disconnected: 'Offline',
}

export default function LiveStatus() {
  const { status } = useSocket()

  return (
    <span className={`live-status live-status-${status}`} aria-live="polite">
      <span className="live-dot" aria-hidden="true" />
      {LABELS[status] || LABELS.disconnected}
    </span>
  )
}
