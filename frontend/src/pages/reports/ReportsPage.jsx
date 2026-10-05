import { useEffect, useState } from 'react'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import AlarmAnalytics from '../../components/reports/AlarmAnalytics'
import BuildingComparison from '../../components/reports/BuildingComparison'
import BuildingHealth from '../../components/reports/BuildingHealth'
import DeviceStatusChart from '../../components/reports/DeviceStatusChart'
import EnergyAnalytics from '../../components/reports/EnergyAnalytics'
import ExecutiveKpis from '../../components/reports/ExecutiveKpis'
import MaintenanceKpis from '../../components/reports/MaintenanceKpis'
import ReportFilters, { reportRange } from '../../components/reports/ReportFilters'
import { MAINTENANCE_REALTIME_EVENTS, REALTIME_EVENTS, buildingRoom } from '../../constants/realtime'
import { useSocket } from '../../hooks/useSocket'
import { listBuildings } from '../../services/building.service'
import {
  getAlarmTrends,
  getBuildingComparison,
  getBuildingHealth,
  getDeviceStatusReport,
  getEnergyTrends,
  getExecutiveSummary,
  getMaintenanceKpis,
} from '../../services/report.service'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

const LIVE_EVENTS = [
  REALTIME_EVENTS.READING_CREATED,
  REALTIME_EVENTS.ALARM_CREATED,
  REALTIME_EVENTS.ALARM_ACKNOWLEDGED,
  REALTIME_EVENTS.ALARM_RESOLVED,
  REALTIME_EVENTS.DEVICE_STATUS_CHANGED,
  ...MAINTENANCE_REALTIME_EVENTS,
]

export default function ReportsPage() {
  const { listen, revision, subscribe } = useSocket()
  const [preset, setPreset] = useState('7d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [interval, setInterval] = useState('day')
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [generatedAt, setGeneratedAt] = useState('')

  useEffect(() => {
    const range = reportRange(preset, from, to)
    if (!range) {
      setLoading(false)
      return undefined
    }
    let ignore = false
    const timer = setTimeout(() => {
      setLoading(true)
      const params = { ...range, buildingId, interval }
      Promise.all([
        getExecutiveSummary(params),
        getBuildingHealth(params),
        getDeviceStatusReport(params),
        getAlarmTrends(params),
        getEnergyTrends(params),
        getMaintenanceKpis(params),
        getBuildingComparison(params),
      ])
        .then(([executive, health, devices, alarms, energy, maintenance, buildings]) => {
          if (ignore) return
          setReport({ executive, health, devices, alarms, energy, maintenance, buildings, range })
          setGeneratedAt(new Date().toISOString())
          setError('')
        })
        .catch((requestError) => {
          if (!ignore) setError(getErrorMessage(requestError))
        })
        .finally(() => {
          if (!ignore) setLoading(false)
        })
    }, preset === 'custom' ? 300 : 0)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [buildingId, from, interval, preset, reloadKey, revision, to])

  useEffect(() => {
    let stop = () => {}
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((data) => {
        if (ignore) return
        const ids = buildingId ? [buildingId] : (data.items || []).map((building) => building.id)
        stop = subscribe(ids.map((id) => buildingRoom(id)))
      })
      .catch(() => {})
    return () => {
      ignore = true
      stop()
    }
  }, [buildingId, subscribe])

  useEffect(() => {
    let timer = null
    const stops = LIVE_EVENTS.map((eventName) => listen(eventName, () => {
      clearTimeout(timer)
      timer = setTimeout(() => setReloadKey((value) => value + 1), 500)
    }))
    return () => {
      clearTimeout(timer)
      stops.forEach((stop) => stop())
    }
  }, [listen])

  function exportBuildings() {
    const rows = [['Building', 'Health Score', 'Device Availability', 'Active Alarms', 'Critical Alarms', 'Energy Consumption', 'Energy Cost', 'Open Maintenance', 'Overdue Maintenance']]
    ;(report?.buildings?.buildings || []).forEach((row) => {
      rows.push([
        row.name,
        row.healthScore ?? 'Not calculated',
        row.deviceAvailability ?? 'Not calculated',
        row.activeAlarms,
        row.criticalAlarms,
        row.energyConsumptionKwh,
        row.estimatedCost,
        row.openMaintenance,
        row.overdueMaintenance,
      ])
    })
    downloadCsv('building-report.csv', rows)
  }

  function exportMaintenance() {
    const rows = [['Work Order', 'Status', 'Priority', 'Device', 'Building', 'Assigned Technician', 'Scheduled Date', 'Completed Date', 'Cost']]
    ;(report?.maintenance?.workOrders || []).forEach((order) => {
      rows.push([
        order.workOrderNumber,
        order.status,
        order.priority,
        order.device?.name || '',
        order.building?.name || '',
        order.assignedTo?.name || '',
        order.scheduledAt || '',
        order.completedAt || '',
        order.totalCost ?? '',
      ])
    })
    downloadCsv('maintenance-report.csv', rows)
  }

  function exportAlarms() {
    const rows = [['Alarm', 'Type', 'Severity', 'Status', 'Device', 'Building', 'Triggered At', 'Acknowledged At', 'Resolved At']]
    ;(report?.alarms?.alarms || []).forEach((alarm) => {
      rows.push([
        alarm.message,
        alarm.type,
        alarm.severity,
        alarm.status,
        alarm.device?.name || '',
        alarm.building?.name || '',
        alarm.triggeredAt || '',
        alarm.acknowledgedAt || '',
        alarm.resolvedAt || '',
      ])
    })
    downloadCsv('alarm-report.csv', rows)
  }

  return (
    <section className="report-page">
      <div className="print-only">
        <h1>BMS operational report</h1>
        <p>Range: {report?.range ? `${formatDateTime(report.range.from)} to ${formatDateTime(report.range.to)}` : 'Not selected'}</p>
        <p>Building: {buildingId || 'All buildings'}</p>
        <p>Generated: {generatedAt ? formatDateTime(generatedAt) : ''}</p>
      </div>
      <div className="page-heading">
        <div>
          <h1>Reports and analytics</h1>
          <p className="lede">Operational figures from the current buildings, devices, alarms, energy readings, and maintenance records.</p>
        </div>
      </div>
      <ReportFilters
        preset={preset}
        from={from}
        to={to}
        buildingId={buildingId}
        interval={interval}
        onPreset={setPreset}
        onFrom={setFrom}
        onTo={setTo}
        onBuilding={setBuildingId}
        onInterval={setInterval}
        onRefresh={() => setReloadKey((value) => value + 1)}
        onExportBuildings={exportBuildings}
        onExportMaintenance={exportMaintenance}
        onExportAlarms={exportAlarms}
      />
      {preset === 'custom' && !reportRange(preset, from, to) ? <p>Choose a start and end time.</p> : null}
      {loading && !report ? <LoadingState message="Loading reports..." /> : null}
      {error && !report ? <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {error && report ? <p className="form-error">{error}</p> : null}
      {report ? (
        <>
          <h2>Executive KPIs</h2>
          <ExecutiveKpis summary={report.executive} />
          <h2>Building health</h2>
          <BuildingHealth report={report.health} />
          <h2>Equipment status</h2>
          <DeviceStatusChart report={report.devices} />
          <h2>Alarm analytics</h2>
          <AlarmAnalytics report={report.alarms} />
          <h2>Energy analytics</h2>
          <EnergyAnalytics report={report.energy} />
          <h2>Maintenance analytics</h2>
          <MaintenanceKpis report={report.maintenance} />
          <h2>Building comparison</h2>
          <BuildingComparison report={report.buildings} />
        </>
      ) : null}
    </section>
  )
}
