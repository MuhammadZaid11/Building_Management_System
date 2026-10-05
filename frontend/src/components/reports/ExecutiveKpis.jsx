import { Link } from 'react-router-dom'
import { formatMetric } from './reportFormat'
import { formatKwh, formatMoney } from '../../utils/format'

export default function ExecutiveKpis({ summary }) {
  if (!summary) return null
  const devices = summary.devices || {}
  const alarms = summary.alarms || {}
  const energy = summary.energy || {}
  const maintenance = summary.maintenance || {}

  return (
    <div className="summary-grid">
      <article className="summary-card"><span>Buildings</span><strong>{summary.buildings?.total ?? 0}</strong></article>
      <Link className="summary-card" to="/devices"><span>Online devices</span><strong>{formatMetric(devices.availabilityPercent, '%')}</strong></Link>
      <Link className="summary-card" to="/alarms"><span>Active alarms</span><strong>{alarms.active ?? 0}</strong></Link>
      <Link className="summary-card" to="/alarms?severity=CRITICAL"><span>Critical alarms</span><strong>{alarms.critical ?? 0}</strong></Link>
      <Link className="summary-card" to="/energy"><span>Energy</span><strong>{formatKwh(energy.consumptionKwh)}</strong></Link>
      <article className="summary-card"><span>Estimated cost</span><strong>{formatMoney(energy.estimatedCost, energy.currency)}</strong></article>
      <Link className="summary-card" to="/maintenance?status=OPEN"><span>Open maintenance</span><strong>{maintenance.open ?? 0}</strong></Link>
      <Link className="summary-card" to="/maintenance/schedules"><span>Overdue maintenance</span><strong>{maintenance.overdue ?? 0}</strong></Link>
    </div>
  )
}
