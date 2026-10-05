import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BuildingComparisonChart from '../../components/energy/BuildingComparisonChart'
import EnergyTrendChart from '../../components/energy/EnergyTrendChart'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import StatusBadge from '../../components/common/StatusBadge'
import { REALTIME_EVENTS } from '../../constants/realtime'
import { useSocket } from '../../hooks/useSocket'
import { listBuildings } from '../../services/building.service'
import { compareEnergy, getBuildingEnergy, getEnergySummary, getEnergyTrend } from '../../services/energy.service'
import { applyLiveReading } from '../../utils/energyLive'
import { getErrorMessage } from '../../utils/errors'
import { formatChange, formatDateTime, formatKwh, formatMoney } from '../../utils/format'

const INTERVALS = [
  { id: 'hour', label: 'Hourly' },
  { id: 'day', label: 'Daily' },
  { id: 'month', label: 'Monthly' },
]

function toIso(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export default function EnergyPage() {
  const { listen, revision } = useSocket()
  const [buildings, setBuildings] = useState([])
  const [buildingId, setBuildingId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [interval, setIntervalValue] = useState('day')
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setBuildings(data.items || [])
      })
      .catch(() => {
        if (!ignore) setBuildings([])
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    const params = {
      buildingId,
      from: toIso(from),
      to: toIso(to),
    }
    setLoading(true)
    Promise.all([
      getEnergySummary(params),
      getEnergyTrend({ ...params, interval }),
      getBuildingEnergy({ from: params.from, to: params.to }),
      compareEnergy(params),
    ])
      .then(([summaryData, trendData, buildingData, compareData]) => {
        if (ignore) return
        setSummary(summaryData)
        setTrend(trendData)
        setBreakdown(buildingData)
        setComparison(compareData)
        setError('')
      })
      .catch((requestError) => {
        if (!ignore) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [buildingId, from, to, interval, revision, reloadKey])

  useEffect(() => listen(REALTIME_EVENTS.READING_CREATED, (reading) => {
    setSummary((current) => applyLiveReading(current, reading))
  }), [listen])

  const meters = summary?.meters || []

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Energy</h1>
          <p className="lede">Consumption, estimated cost, and meter readings. Periods are aggregated in UTC.</p>
        </div>
      </div>
      <div className="toolbar">
        <label>
          Building
          <select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">All buildings</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        <label>
          From
          <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      {error ? <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {loading && !summary ? <p>Loading energy data...</p> : null}
      {summary ? (
        <>
          <h2>Energy summary</h2>
          {summary.meterResetDetected ? <p className="notice">A meter reset was detected. The drop was excluded so consumption is not negative.</p> : null}
          <div className="summary-grid">
            <article className="summary-card"><span>Total energy</span><strong>{formatKwh(summary.totalConsumptionKwh)}</strong></article>
            <article className="summary-card"><span>Estimated cost</span><strong>{formatMoney(summary.estimatedCost, summary.currency)}</strong></article>
            <article className="summary-card"><span>Daily average</span><strong>{formatKwh(summary.averageDailyKwh)}</strong></article>
            <article className="summary-card"><span>Previous period</span><strong>{formatKwh(summary.previousPeriodConsumptionKwh)}</strong></article>
            <article className="summary-card"><span>Change</span><strong>{formatChange(summary.changePercent)}</strong></article>
          </div>
          <h2>Consumption trend</h2>
          <p>{trend?.source === 'ESTIMATED' ? 'Estimated from power samples.' : 'Measured from cumulative meter readings.'}</p>
          <div className="range-switch" role="group" aria-label="Trend interval">
            {INTERVALS.map((item) => (
              <button key={item.id} type="button" className={interval === item.id ? 'button button-primary' : 'button'} aria-pressed={interval === item.id} onClick={() => setIntervalValue(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <EnergyTrendChart points={trend?.points || []} source={trend?.source} />
          <h2>Building comparison</h2>
          <BuildingComparisonChart buildings={breakdown?.buildings || []} currency={breakdown?.currency || summary.currency} />
          <h2>Cost summary</h2>
          <dl className="facts facts-grid">
            <div><dt>Consumption</dt><dd>{formatKwh(summary.totalConsumptionKwh)}</dd></div>
            <div><dt>Rate</dt><dd>{formatMoney(summary.ratePerKwh, summary.currency)}/kWh</dd></div>
            <div><dt>Estimated cost</dt><dd>{formatMoney(summary.estimatedCost, summary.currency)}</dd></div>
            <div><dt>Daily target</dt><dd>{summary.dailyTargetKwh === null ? 'Not configured' : formatKwh(summary.dailyTargetKwh)}</dd></div>
          </dl>
          <p className="lede">Estimated cost uses the configured rate. It is not a utility bill.</p>
          <h2>Energy meters</h2>
          {meters.length === 0 ? <EmptyState message="No energy meters are configured for this selection." /> : (
            <DataTable
              rowKey={(meter) => meter.deviceId}
              rows={meters}
              columns={[
                { key: 'device', header: 'Meter', render: (meter) => meter.deviceName },
                { key: 'building', header: 'Building', render: (meter) => meter.buildingName },
                { key: 'room', header: 'Room', render: (meter) => meter.roomName },
                { key: 'latest', header: 'Latest reading', render: (meter) => (meter.latestValue === null ? '—' : `${meter.latestValue} ${meter.unit}`) },
                { key: 'unit', header: 'Unit', render: (meter) => meter.unit },
                { key: 'consumption', header: 'Consumption', render: (meter) => formatKwh(meter.consumptionKwh) },
                { key: 'status', header: 'Status', render: (meter) => <StatusBadge status={meter.status} /> },
                { key: 'updated', header: 'Last updated', render: (meter) => formatDateTime(meter.recordedAt) },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (meter) => (
                    <span className="table-actions">
                      <Link className="button button-quiet" to={`/devices/${meter.deviceId}`}>Open device</Link>
                      <Link className="button button-quiet" to={`/sensors/${meter.sensorId}`}>Open sensor</Link>
                    </span>
                  ),
                },
              ]}
            />
          )}
          <h2>Period comparison</h2>
          {comparison ? (
            <dl className="facts facts-grid">
              <div><dt>Current period</dt><dd>{formatKwh(comparison.currentConsumptionKwh)}</dd></div>
              <div><dt>Previous period</dt><dd>{formatKwh(comparison.previousConsumptionKwh)}</dd></div>
              <div><dt>Difference</dt><dd>{formatKwh(comparison.differenceKwh)}</dd></div>
              <div><dt>Direction</dt><dd>{comparison.direction}</dd></div>
              <div><dt>Change</dt><dd>{formatChange(comparison.changePercent)}</dd></div>
            </dl>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
