import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { AlarmStatusBadge, SeverityBadge } from '../common/StatusBadge'
import { MAINTENANCE_REALTIME_EVENTS, REALTIME_EVENTS } from '../../constants/realtime'
import { useSocket } from '../../hooks/useSocket'
import {
  getAlarmTrends,
  getBuildingHealth,
  getDeviceStatusReport,
  getEnergyTrends,
  getExecutiveSummary,
  getMaintenanceKpis,
} from '../../services/report.service'
import { formatMetric } from './reportFormat'
import { formatKwh, formatMoney } from '../../utils/format'

const LIVE_EVENTS = [
  REALTIME_EVENTS.ALARM_CREATED,
  REALTIME_EVENTS.ALARM_ACKNOWLEDGED,
  REALTIME_EVENTS.ALARM_RESOLVED,
  REALTIME_EVENTS.DEVICE_STATUS_CHANGED,
  REALTIME_EVENTS.READING_CREATED,
  ...MAINTENANCE_REALTIME_EVENTS,
]

function todayRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return { from: start.toISOString(), to: now.toISOString(), interval: 'hour' }
}

function weekRange() {
  const now = new Date()
  return {
    from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    to: now.toISOString(),
    interval: 'day',
  }
}

export default function DashboardOperations() {
  const { listen, revision } = useSocket()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    const today = todayRange()
    const week = weekRange()
    Promise.all([
      getExecutiveSummary(today),
      getDeviceStatusReport(today),
      getBuildingHealth(today),
      getAlarmTrends(week),
      getEnergyTrends(today),
      getMaintenanceKpis(today),
    ])
      .then(([executive, devices, health, alarms, energy, maintenance]) => {
        if (!ignore) {
          setError('')
          setData({ executive, devices, health, alarms, energy, maintenance })
        }
      })
      .catch(() => {
        if (!ignore) setError('Operational overview is unavailable.')
      })
    return () => {
      ignore = true
    }
  }, [reloadKey, revision])

  useEffect(() => {
    let timer = null
    const stops = LIVE_EVENTS.map((eventName) => listen(eventName, () => {
      clearTimeout(timer)
      timer = setTimeout(() => setReloadKey((value) => value + 1), 700)
    }))
    return () => {
      clearTimeout(timer)
      stops.forEach((stop) => stop())
    }
  }, [listen])

  if (error) return <p role="alert">{error}</p>
  if (!data) return <p>Loading operational overview...</p>

  const executive = data.executive
  const criticalAlarms = (data.alarms.alarms || []).filter((alarm) => alarm.severity === 'CRITICAL' && alarm.status !== 'RESOLVED').slice(0, 5)
  const offline = data.devices.offlineDevices || []
  const health = [...(data.health.buildings || [])].sort((left, right) => (left.score ?? -1) - (right.score ?? -1)).slice(0, 4)

  return (
    <section className="panel">
      <h2>Operations</h2>
      <p className="lede"><Link to="/reports">Open reports</Link></p>
      <div className="summary-grid">
        <article className="summary-card"><span>Buildings</span><strong>{executive.buildings.total}</strong></article>
        <article className="summary-card"><span>Online devices</span><strong>{executive.devices.online}</strong></article>
        <article className="summary-card"><span>Active alarms</span><strong>{executive.alarms.active}</strong></article>
        <article className="summary-card"><span>Critical alarms</span><strong>{executive.alarms.critical}</strong></article>
        <article className="summary-card"><span>Energy today</span><strong>{formatKwh(executive.energy.consumptionKwh)}</strong></article>
        <article className="summary-card"><span>Open maintenance</span><strong>{executive.maintenance.open}</strong></article>
      </div>
      <p>Estimated cost today: {formatMoney(data.energy.summary.estimatedCost, data.energy.summary.currency)}. Availability: {formatMetric(data.devices.overall.availabilityPercent, '%')}.</p>
      <h3>Building health</h3>
      {health.length === 0 ? <EmptyState message="No building health score is available." /> : (
        <ul>
          {health.map((building) => (
            <li key={building.buildingId}>
              <Link to={`/buildings/${building.buildingId}`}>{building.buildingName}</Link>
              {' '}{formatMetric(building.score)} {building.status || ''}
            </li>
          ))}
        </ul>
      )}
      <h3>Critical alarms</h3>
      {criticalAlarms.length === 0 ? <EmptyState message="No unresolved critical alarms in the last 7 days." /> : (
        <DataTable
          rowKey={(alarm) => alarm.id}
          rows={criticalAlarms}
          columns={[
            { key: 'severity', header: 'Severity', render: (alarm) => <SeverityBadge severity={alarm.severity} /> },
            { key: 'message', header: 'Alarm', render: (alarm) => <Link to={`/alarms/${alarm.id}`}>{alarm.message}</Link> },
            { key: 'status', header: 'Status', render: (alarm) => <AlarmStatusBadge status={alarm.status} /> },
          ]}
        />
      )}
      <h3>Offline devices</h3>
      {offline.length === 0 ? <EmptyState message="No devices are offline." /> : (
        <ul>
          {offline.map((device) => (
            <li key={device.id}><Link to={`/devices/${device.id}`}>{device.name}</Link> {device.buildingName ? `(${device.buildingName})` : ''}</li>
          ))}
        </ul>
      )}
      <p><Link to="/maintenance/schedules">Overdue maintenance: {data.maintenance.summary.overdue ?? 'Not calculated'}</Link></p>
    </section>
  )
}
