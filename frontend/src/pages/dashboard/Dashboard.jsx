import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import DashboardOperations from '../../components/reports/DashboardOperations'
import EmptyState from '../../components/common/EmptyState'
import { AlarmStatusBadge, SeverityBadge } from '../../components/common/StatusBadge'
import { MAINTENANCE_REALTIME_EVENTS, REALTIME_EVENTS, buildingRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { getAlarmSummary, listAlarms } from '../../services/alarm.service'
import { getEnergySummary } from '../../services/energy.service'
import { getMaintenanceSummary } from '../../services/maintenance.service'
import { applyLiveReading } from '../../utils/energyLive'
import { formatChange, formatKwh, formatKw, formatMoney } from '../../utils/format'
import { getHealth } from '../../services/api'
import { listBuildings } from '../../services/building.service'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

function adjustCount(summary, severity, delta) {
  if (!summary || !severity) return summary
  const key = severity.toLowerCase()
  if (!(key in summary)) return summary
  const next = { ...summary, [key]: Math.max(0, summary[key] + delta) }
  next.total = next.low + next.medium + next.high + next.critical
  return next
}

function upsertRecent(current, alarm) {
  if (alarm.status !== 'ACTIVE') {
    return current.filter((item) => item.id !== alarm.id)
  }
  const rest = current.filter((item) => item.id !== alarm.id)
  return [alarm, ...rest].slice(0, 5)
}

export default function Dashboard() {
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const [health, setHealth] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [recent, setRecent] = useState([])
  const [recentError, setRecentError] = useState('')
  const [recentLoaded, setRecentLoaded] = useState(false)
  const [energy, setEnergy] = useState(null)
  const [energyError, setEnergyError] = useState('')
  const [maintenance, setMaintenance] = useState(null)
  const [maintenanceError, setMaintenanceError] = useState('')

  useEffect(() => {
    let ignore = false

    getHealth()
      .then((data) => {
        if (!ignore) {
          setHealth(data)
          setStatusError('')
        }
      })
      .catch((error) => {
        if (!ignore) {
          setHealth(null)
          setStatusError(getErrorMessage(error))
        }
      })

    getAlarmSummary()
      .then((data) => {
        if (!ignore) {
          setSummary(data)
          setSummaryError('')
        }
      })
      .catch((error) => {
        if (!ignore) setSummaryError(getErrorMessage(error))
      })

    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    getEnergySummary({ from: startOfToday.toISOString(), to: now.toISOString() })
      .then((data) => {
        if (!ignore) {
          setEnergy(data)
          setEnergyError('')
        }
      })
      .catch((error) => {
        if (!ignore) setEnergyError(getErrorMessage(error))
      })

    getMaintenanceSummary()
      .then((data) => {
        if (!ignore) {
          setMaintenance(data)
          setMaintenanceError('')
        }
      })
      .catch((error) => {
        if (!ignore) setMaintenanceError(getErrorMessage(error))
      })

    listAlarms({ status: 'ACTIVE', page: 1, limit: 5 })
      .then((data) => {
        if (!ignore) {
          setRecent(data.items)
          setRecentError('')
        }
      })
      .catch((error) => {
        if (!ignore) setRecentError(getErrorMessage(error))
      })
      .finally(() => {
        if (!ignore) setRecentLoaded(true)
      })

    return () => {
      ignore = true
    }
  }, [revision])

  useEffect(() => {
    let stop = () => {}
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((data) => {
        if (ignore) return
        stop = subscribe((data.items || []).map((building) => buildingRoom(building.id)))
      })
      .catch(() => {})
    return () => {
      ignore = true
      stop()
    }
  }, [revision, subscribe])

  useEffect(() => {
    const offCreated = listen(REALTIME_EVENTS.ALARM_CREATED, (alarm) => {
      if (alarm.status === 'ACTIVE') {
        setSummary((current) => adjustCount(current, alarm.severity, 1))
      }
      setRecent((current) => upsertRecent(current, alarm))
    })
    const offAcknowledged = listen(REALTIME_EVENTS.ALARM_ACKNOWLEDGED, (alarm) => {
      if (alarm.previousStatus === 'ACTIVE') {
        setSummary((current) => adjustCount(current, alarm.severity, -1))
      }
      setRecent((current) => current.filter((item) => item.id !== alarm.id))
    })
    const offReading = listen(REALTIME_EVENTS.READING_CREATED, (reading) => {
      setEnergy((current) => applyLiveReading(current, reading))
    })
    const maintenanceStops = MAINTENANCE_REALTIME_EVENTS.map((eventName) => listen(eventName, () => {
      getMaintenanceSummary()
        .then((data) => setMaintenance(data))
        .catch(() => {})
    }))
    const offResolved = listen(REALTIME_EVENTS.ALARM_RESOLVED, (alarm) => {
      if (alarm.previousStatus === 'ACTIVE') {
        setSummary((current) => adjustCount(current, alarm.severity, -1))
      }
      setRecent((current) => current.filter((item) => item.id !== alarm.id))
    })
    return () => {
      offCreated()
      offAcknowledged()
      offResolved()
      offReading()
      maintenanceStops.forEach((stop) => stop())
    }
  }, [listen])

  return (
    <section className="dashboard">
      <h1>Building Management System</h1>
      <p className="welcome">Welcome, {user.name}</p>
      <DashboardOperations />
      <dl className="facts">
        <div>
          <dt>Role</dt>
          <dd>{user.role}</dd>
        </div>
      </dl>
      <section className="panel">
        <h2>Energy overview</h2>
        <p className="lede"><Link to="/energy">Open energy analytics</Link></p>
        {energyError ? <p className="form-error">{energyError}</p> : null}
        {energy ? (
          <div className="summary-grid">
            <article className="summary-card"><span>Today</span><strong>{formatKwh(energy.totalConsumptionKwh)}</strong></article>
            <article className="summary-card"><span>Estimated cost</span><strong>{formatMoney(energy.estimatedCost, energy.currency)}</strong></article>
            <article className="summary-card"><span>Current power</span><strong>{formatKw(energy.currentPowerKw)}</strong></article>
            <article className="summary-card"><span>Vs previous day</span><strong>{formatChange(energy.changePercent)}</strong></article>
          </div>
        ) : null}
        {!energy && !energyError ? <p>Loading energy...</p> : null}
      </section>
      <section className="panel">
        <h2>Maintenance</h2>
        <p className="lede"><Link to="/maintenance">Open maintenance</Link></p>
        {maintenanceError ? <p className="form-error">{maintenanceError}</p> : null}
        {maintenance ? (
          <div className="summary-grid">
            <article className="summary-card"><span>Open work orders</span><strong>{maintenance.open}</strong></article>
            <article className="summary-card"><span>In progress</span><strong>{maintenance.inProgress}</strong></article>
            <article className="summary-card"><span>Overdue maintenance</span><strong>{maintenance.overdue}</strong></article>
            <article className="summary-card"><span>Critical maintenance</span><strong>{maintenance.critical}</strong></article>
          </div>
        ) : null}
        {!maintenance && !maintenanceError ? <p>Loading maintenance...</p> : null}
      </section>
      <section className="panel">
        <h2>Active alarms</h2>
        {summaryError ? <p className="form-error">{summaryError}</p> : null}
        {summary ? (
          <div className="summary-grid">
            <Link className="summary-card" to="/alarms"><span>Total</span><strong>{summary.total}</strong></Link>
            <Link className="summary-card" to="/alarms?severity=CRITICAL"><span>Critical</span><strong>{summary.critical}</strong></Link>
            <Link className="summary-card" to="/alarms?severity=HIGH"><span>High</span><strong>{summary.high}</strong></Link>
            <Link className="summary-card" to="/alarms?severity=MEDIUM"><span>Medium</span><strong>{summary.medium}</strong></Link>
            <Link className="summary-card" to="/alarms?severity=LOW"><span>Low</span><strong>{summary.low}</strong></Link>
          </div>
        ) : null}
        {!summary && !summaryError ? <p>Loading alarm summary...</p> : null}
      </section>
      <section className="panel">
        <h2>Recent alarms</h2>
        {recentError ? <p className="form-error">{recentError}</p> : null}
        {recentLoaded && recent.length === 0 && !recentError ? <EmptyState message="No active alarms." /> : null}
        {recent.length > 0 ? (
          <DataTable
            rowKey={(alarm) => alarm.id}
            rows={recent}
            columns={[
              { key: 'severity', header: 'Severity', render: (alarm) => <SeverityBadge severity={alarm.severity} /> },
              { key: 'type', header: 'Type', render: (alarm) => alarm.type },
              { key: 'device', header: 'Device', render: (alarm) => alarm.device?.name || '—' },
              { key: 'message', header: 'Message', render: (alarm) => <Link to={`/alarms/${alarm.id}`}>{alarm.message}</Link> },
              { key: 'time', header: 'Time', render: (alarm) => formatDateTime(alarm.triggeredAt) },
              { key: 'status', header: 'Status', render: (alarm) => <AlarmStatusBadge status={alarm.status} /> },
            ]}
          />
        ) : null}
      </section>
      <section className="panel" aria-live="polite">
        <h2>System status</h2>
        {health ? (
          <dl className="facts">
            <div>
              <dt>API</dt>
              <dd>{health.status}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{health.database}</dd>
            </div>
          </dl>
        ) : null}
        {statusError ? <p className="form-error">{statusError}</p> : null}
        {!health && !statusError ? <p>Checking system status...</p> : null}
      </section>
    </section>
  )
}
